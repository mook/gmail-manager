// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

const GM_NOTIFY_STATE = "gmanager-accounts-notify-state";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const Ci = Components.interfaces;
const Cc = Components.classes;

function gmServiceGmail()
{
  // Load the services
  this._logger = Cc["@longfocus.com/gmanager/logger;1"].getService(Ci.gmILogger);
  this._cookieService = Cc["@longfocus.com/gmanager/cookies;1"].getService(Ci.gmICookies);
  this._cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
  this._observer = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  
  if ("@mozilla.org/xre/app-info;1" in Cc)
  {
    var platformVersion = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).platformVersion;
    this._swapCookies = (platformVersion == null || platformVersion < "1.8.1");
  }
}
gmServiceGmail.prototype = {
  _email: null,
  _password: null,
  _isHosted: false,
  _username: null,
  _domain: null,
  _loginURL: null,
  _checkURL: null,
  _status: Components.interfaces.gmIService.STATE_LOGGED_OUT,
  _loggedIn: false,
  _checking: false,
  _inboxUnread: 0,
  _savedDrafts: 0,
  _spamUnread: 0,
  _spaceUsed: null,
  _percentUsed: null,
  _totalSpace: null,
  _labels: null,
  _snippets: null,
  _timer: null,
  _connectionPhase: 0,
  _channel: null,
  _cookies: null,
  _swapCookies: true,
  
  _log: function(aMsg)
  {
    this._logger.log("(" + this.email + ") " + aMsg);
  },
  
  /**
   * gmIServiceGmail
   */
  get isHosted() { return this._isHosted; },
  get username() { return this._username; },
  get domain() { return this._domain; },
  
  /**
   * gmIService
   */
  get email() { return this._email; },
  get status() { return this._status; },
  get loggedIn() { return this._loggedIn; },
  get checking() { return this._checking; },
  get inboxUnread() { return this._inboxUnread; },
  get savedDrafts() { return this._savedDrafts; },
  get spamUnread() { return this._spamUnread; },
  get spaceUsed() { return this._spaceUsed; },
  get percentUsed() { return this._percentUsed; },
  get totalSpace() { return this._totalSpace; },

  getInboxAsync: function gmServiceGmail_getInboxAsync(aCallback, aPassword)
  {
    var self = this;
    this._getServiceURI(function(aURL, aData, aCookies) {

      if (aCookies !== null)
        self._cookieLoader(aCookies);

      aCallback.onGetService(aURL, aData);
    }, aPassword);
  },

  getComposeAsync: function gmServiceGmail_getComposeAsync(aCallback, aPassword, aHref)
  {
    var href = "";
    if (aHref) {
      href = aHref.replace("mailto:", "&to=")
                  .replace("subject=", "su=")
                  .replace(/ /g, "%20")
                  .replace("?", "&");
    }
    var self = this;

    this._getServiceURI(function(aURL, aData, aCookies) {

      if (aCookies !== null)
        self._cookieLoader(aCookies);

      aCallback.onGetService(aURL, aData);
    }, aPassword, "view=cm&fs=1" + href);
  },
  
  _getServiceURI: function gmServiceGmail_getServiceURI(aAsyncCallback,
                                                        /* Optional */ aPassword,
                                                        /* Optional */ aContinueData)
  {
    var serviceURI = new Object();

    serviceURI.url = this._loginURL;
    serviceURI.data = "ltmpl=default&ltmplcache=2" + 
                      "&continue=" + encodeURIComponent(this._checkURL + (aContinueData || "")) + 
                      "&service=mail&rm=false&ltmpl=default" + 
                      "&Email=" + encodeURIComponent(this.isHosted ? this.username : this.email) + 
                      "&Passwd=" + encodeURIComponent(aPassword || this._password) + 
                      "&signIn=Sign+in";

    try {
      // Cookie needed for Gmail Offline
      var cookie = {
          name: (this.isHosted ? "GAUSR@" + this.domain : "GAUSR"),
          value: this.email,
          domain: "mail.google.com",
          host: "mail.google.com" /* nsICookie */,
          path: (this.isHosted ? "/a/" + this.domain : "/mail"),
          isSecure: false,
          isHttpOnly: false,
          isSession: true,
          expires: Math.pow(2, 34)
        }
      
      // Check if the cookie exists
      if (!this._cookieManager.cookieExists(cookie))
      {
        // Load the cookie if it does not exist
        this._cookieLoader([[[cookie]]]);
      }
    } catch(e) {
      this._log("Error fixing Gmail Offline: " + e);
    }

    try {
      var xmlHttpRequest = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                             .createInstance(Ci.nsIXMLHttpRequest);

      // Send the HTTP request
      xmlHttpRequest.open("GET", this._loginURL, aAsyncCallback ? true : false);

      var self = this;
      function gmServiceGmail_getServiceURI_processresult() {
        if (xmlHttpRequest.readyState == 4 && xmlHttpRequest.status === 200) {
          self._log("service data: " + xmlHttpRequest.responseText);
          
          // Get the HTTP channel
          var httpChannel = xmlHttpRequest.channel.QueryInterface(Ci.nsIHttpChannel);
          
          // Digest the HTTP response cookies
          serviceURI.cookies = self._cookieMonster(httpChannel);
          
          // Get the login form
          var formMatches = xmlHttpRequest.responseText.match(/<form[^>]+?id=["']gaia_loginform["']((?:.|\s)+?)<\/form>/i);
          self._log("\"form\" match was " + (formMatches ? "found" : "not found"));
          
          if (formMatches !== null) {
            // Get the hidden inputs
            var inputMatches = (formMatches[1].match(/<input[^>]+?type=["']hidden["'][^>]+?\/>/ig) || []);
            self._log("\"input\" matches were " + (inputMatches.length > 0 ? "found" : "not found"));
            
            for (var i = 0; i < inputMatches.length; i++)
            {
              // Get the input name attribute
              var inputName = inputMatches[i].match(/name=["']((?:.|\s)+?)["']/i);
              self._log("\"name\" match was " + (inputName ? "found" : "not found"));
              
              if (inputName !== null && inputName[1] === "GALX")
              {
                // Build the input name/value pair
                var inputValue = inputMatches[i].match(/value=["']((?:.|\s)*?)["']/i);
                var inputPair = inputName[1] + "=" + inputValue[1];
                self._log("inputPair = " + inputPair);
                serviceURI.data += "&" + inputPair;
              }
            }
          }
          try {
            aAsyncCallback(serviceURI.url, serviceURI.data, serviceURI.cookies);
          }
          catch (e) {
            self._log("Error calling async callback: " + e);
          }
          delete self;
          delete xmlHttpRequest;
        }
      }

      xmlHttpRequest.onreadystatechange = gmServiceGmail_getServiceURI_processresult;
      xmlHttpRequest.channel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
      xmlHttpRequest.send(null);
    } catch(e) {
      this._log("Error sending the HTTP request: " + e);
    }
  },
  
  getLabels: function(aCount)
  {
    var labels = (this._labels || []);
    if (aCount)
    {
      aCount.value = labels.length;
    }
    return labels;
  },
  
  getSnippets: function(aCount)
  {
    var snippets = (this._snippets || []);
    if (aCount)
    {
      aCount.value = snippets.length;
    }
    return snippets;
  },
  
  init: function(aEmail)
  {
    const mailRegExp = /@g(?:oogle)?mail.com$/;
    
    this._email = aEmail.toLowerCase();
    this._isHosted = !mailRegExp.test(this.email);
    this._username = this.email.split("@")[0];
    this._domain = this.email.split("@")[1];
    
    // Check if the email is hosted
    if (this.isHosted)
    {
      this._loginURL = "https://www.google.com/a/" + this.domain + "/LoginAction2";
      this._checkURL = "https://mail.google.com/a/" + this.domain + "/?";
    }
    else
    {
      this._loginURL = "https://www.google.com/accounts/ServiceLoginAuth";
      this._checkURL = "https://mail.google.com/mail/?";
    }
  },
  
  login: function gmServiceGmail_login(aPassword)
  {
    const emptyRegExp = /^\s*$/;
    
    // Check if already logged in or checking
    if (this.loggedIn || this.checking)
      return;
    
    // Check if the password is specified
    if (aPassword === null || emptyRegExp.test(aPassword))
    {
      // Password error, lets just give up
      this.logout(Components.interfaces.gmIService.STATE_ERROR_PASSWORD);
    }
    else
    {
      // Save the password in case of connection timeout
      this._password = aPassword;

      this._setChecking(true);

      // Get the connection details
      var self = this;
      function gmServiceGmail_login_callback(aURL, aData, aCookies) {
        // Setup the cookies
        self._cookies = aCookies;
        
        // Set checking and send the server request
        self._serverRequest(aURL, aData);
      }
      this._getServiceURI(gmServiceGmail_login_callback, aPassword, "labs=0");
    }
  },
  
  logout: function(/* Optional */ aStatus)
  {
    if (this.checking)
      this._setChecking(false);
    
    this._defaults();
    this._setStatus(aStatus || Components.interfaces.gmIService.STATE_LOGGED_OUT);
  },
  
  check: function()
  {
    // Check if already checking
    if (this.checking)
      return;
    
    // Set checking and send the server request
    this._setChecking(true);
    this._serverRequest(this._checkURL + "labs=0");
  },
  
  notify: function(aTimer)
  {
    // Check if already checking
    if (this.checking)
    {
      // Timeout error, try again in 30 seconds
      this._setRetryError(Components.interfaces.gmIService.STATE_ERROR_TIMEOUT);
    }
    else
    {
      // Check if already logged in
      if (this.loggedIn)
        this.check();
      else
        this.login(this._password);
    }
  },
  
  resetUnread: function()
  {
    // Reset the unread counts
    this._inboxUnread = 0;
    this._spamUnread = 0;
    this._snippets = null;
    
    if (this._labels !== null)
    {
      for (var i = 0; i < this._labels.length; i++)
        this._labels[i].unread = 0;
    }
    
    // Update the status so that any observers get notified 
    // and can update the account details appropriately
    this._setStatus(this.status);
  },
  
  _setStatus: function(aStatus)
  {
    // Notify the observers with the status
    this._status = aStatus;
    this._observer.notifyObservers(null, GM_NOTIFY_STATE, this.email + "|" + this.status);
  },
  
  _setChecking: function(aChecking)
  {
    if (aChecking)
    {
      // Preserve request cookies (prior to Mozilla 1.8.1)
      if (this._swapCookies)
      {
        // Load the Google cookies
        this._cookieService.loadSession("google.com");
      }
      
      try {
        // Add the HTTP observers
        this._observer.addObserver(this, "http-on-modify-request", false);
        this._observer.addObserver(this, "http-on-examine-response", false);
      } catch(e) {
        this._log("Error adding the HTTP observers: " + e);
      }
      
      // Set the status connecting
      this._setStatus(Components.interfaces.gmIService.STATE_CONNECTING);
      
      // Reset the connection phase
      this._connectionPhase = 0;
      
      // Start the timeout timer (30 seconds)
      this._startTimer(30000);
    }
    else
    {
      // Preserve request cookies (prior to Mozilla 1.8.1)
      if (this._swapCookies)
      {
        // Restore the Google cookies
        this._cookieService.restoreSession("google.com");
      }
      
      try {
        // Remove the HTTP observers
        this._observer.removeObserver(this, "http-on-modify-request");
        this._observer.removeObserver(this, "http-on-examine-response");
      } catch(e) {
        this._log("Error removing the HTTP observers: " + e);
      }
      
      // Stop the timeout timer
      this._timer.cancel();
    }
    
    // Set whether checking or not
    this._checking = aChecking;
  },
  
  _startTimer: function(aInterval)
  {
    // Stop the timeout timer
    this._timer.cancel();
    
    // Start the timeout timer, fire only once
    this._timer.initWithCallback(this, aInterval, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },
  
  _setRetryError: function(aStatus)
  {
    this._setChecking(false);
    this._setStatus(aStatus);
    this._startTimer(30000);
  },
  
  _defaults: function()
  {
    // Account details
    this._password = null;
    this._loggedIn = false;
    this._checking = false;
    this._inboxUnread = 0;
    this._savedDrafts = 0;
    this._spamUnread = 0;
    this._spaceUsed = null;
    this._percentUsed = null;
    this._totalSpace = null;
    this._labels = null;
    this._snippets = null;
    
    // Login stuff
    this._connectionPhase = 0;
    this._channel = null;
    this._cookies = null;
  },
  
  _serverRequest: function(aURL, /* Optional */ aData)
  {
    this._log("request URL = " + aURL);
    
    var ioService = Components.classes["@mozilla.org/network/io-service;1"].createInstance(Components.interfaces.nsIIOService);
    var uri = ioService.newURI(aURL, null, null);
    
    // Create the HTTP channel to follow
    this._channel = ioService.newChannelFromURI(uri);
    
    // Check for any POST data
    if (typeof aData === "string")
    {
      var stringInputStream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
      stringInputStream.setData(aData, aData.length);
      
      var uploadChannel = this._channel.QueryInterface(Components.interfaces.nsIUploadChannel);
      uploadChannel.setUploadStream(stringInputStream, "application/x-www-form-urlencoded", -1);
      
      var httpChannel = this._channel.QueryInterface(Components.interfaces.nsIHttpChannel);
      httpChannel.requestMethod = "POST";
    }
    
    // Create the observer for server response
    var observer = new this.observer(this, aData);
    
    // Open the HTTP channel for server request
    this._channel.notificationCallbacks = observer;
    this._channel.asyncOpen(observer, null);
  },
  
  _cookieLoader: function(aCookies)
  {
    this._log("Start the cookie loader...");
    
    for (var cookieDomain in aCookies)
    {
      for (var cookiePath in aCookies[cookieDomain])
      {
        for (var cookieName in aCookies[cookieDomain][cookiePath])
        {
          var cookie = aCookies[cookieDomain][cookiePath][cookieName];
          
          this._log("cookie.name = " + cookie.name);
          this._log("cookie.value = " + cookie.value);
          this._log("cookie.domain = " + cookie.domain);
          this._log("cookie.path = " + cookie.path);
          
          try {
            this._cookieManager.add(cookie.domain, cookie.path, cookie.name, cookie.value, cookie.isSecure, cookie.isHttpOnly, cookie.isSession, cookie.expires);
          } catch(e) {
            this._cookieManager.add(cookie.domain, cookie.path, cookie.name, cookie.value, cookie.isSecure, cookie.isSession, cookie.expires);
          }
        }
      }
    }
    
    this._log("The cookie loader is done!");
  },
  
  _cookieMonster: function(aHttpChannel, /* Optional */ aCookies)
  {
    this._log("Start the cookie monster...");
    
    var cookies = aCookies;
    
    if (cookies == null)
      cookies = new Object();
    
    try {
      var cookieHeader = aHttpChannel.getResponseHeader("Set-Cookie");
      
      String.prototype.firstMatch = function(aRegExp)
      {
        var firstMatch = null;
        try {
          var match = this.match(aRegExp);
          firstMatch = (match && match[1] || null);
        } catch(e) {
          /* Regular expression format error */
        }
        return firstMatch;
      }
      
      var rawCookies = cookieHeader.split("\n");
      
      for (var i = 0; i < rawCookies.length; i++)
      {
        var cookiePair = rawCookies[i].firstMatch(/^(.*?)(?=;|$)/);
        var cookieName = cookiePair.firstMatch(/(.*?)=/);
        var cookieValue = cookiePair.firstMatch(/=(.*)/);
        var cookieDomain = rawCookies[i].firstMatch(/;Domain=(.*?)(?=;|$)/i);
        var cookieExpires = rawCookies[i].firstMatch(/;Expires=(.*?)(?=;|$)/i);
        var cookiePath = rawCookies[i].firstMatch(/;Path=(.*?)(?=;|$)/i);
        var cookieSecure = /;Secure(?=;|$)/i.test(rawCookies[i]);
        var cookieHttpOnly = /;HttpOnly(?=;|$)/i.test(rawCookies[i]);
        
        if (cookieDomain === null)
          cookieDomain = aHttpChannel.URI.host;
        
        if (cookieExpires !== null)
          cookieExpires = cookieExpires.replace(/-/g, " ");
        
        if (cookies[cookieDomain] == null)
          cookies[cookieDomain] = new Object();
        
        if (cookies[cookieDomain][cookiePath] == null)
          cookies[cookieDomain][cookiePath] = new Object();
        
        this._log("rawCookie = " + rawCookies[i]);
        this._log("cookiePair = " + cookiePair);
        this._log("cookieDomain = " + cookieDomain);
        this._log("cookiePath = " + cookiePath);
        
        // Check if the cookie has expired
        if (Date.parse(cookieExpires) < Date.now())
          delete cookies[cookieDomain][cookiePath][cookieName];
        else
          cookies[cookieDomain][cookiePath][cookieName] = { pair: cookiePair, name: cookieName, value: cookieValue, 
              domain: cookieDomain, path: cookiePath, expires: (cookieExpires || Math.pow(2, 34)), 
              isSecure: cookieSecure, isHttpOnly: cookieHttpOnly, isSession: (cookieExpires === null) };
      }
    } catch(e) {
      this._log("Error reading the cookies from the response header: " + e);
    }
    
    this._log("The cookie monster is done!");
    
    return cookies;
  },
  
  observe: function(aSubject, aTopic, aData)
  {
    // Check if this is the channel being followed
    if (aSubject === this._channel)
    {
      // Get the HTTP channel
      var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
      
      if (this._cookies === null)
        this._cookies = new Object();
      
      switch (aTopic)
      {
        case "http-on-modify-request":
        {
          // Clears the cookies
          httpChannel.setRequestHeader("Cookie", "", false);
          
          for (var cookieDomain in this._cookies)
          {
            // Check if the cookie should be added to this request
            if (httpChannel.URI.host.indexOf(cookieDomain) > -1)
            {
              for (var cookiePath in this._cookies[cookieDomain])
              {
                for (var cookieName in this._cookies[cookieDomain][cookiePath])
                {
                  var cookie = this._cookies[cookieDomain][cookiePath][cookieName];
                  
                  this._log("Adding the cookie to the request header: " + cookie.pair);
                  
                  // Add the cookie to the request header
                  httpChannel.setRequestHeader("Cookie", cookie.pair, true);
                }
              }
            }
          }
          
          break;
        }
        case "http-on-examine-response":
        {
          // Save the incoming cookies
          this._cookies = this._cookieMonster(httpChannel, this._cookies);
          
          // Clear the incoming cookies (Firefox 2.0, Mozilla 1.8.1)
          httpChannel.setResponseHeader("Set-Cookie", "", false);
          
          break;
        }
      }
    }
  },
  
  callback: function(aData, aRequest, aObserver)
  {
    // Get the HTTP channel
    var httpChannel = aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);
    
    try {
      const SIDResetRegExp = /\/(?:ServiceLoginAuth|CheckCookie)/;
      const loginRegExp = /\/(?:ServiceLoginAuth|LoginAction)/i;
      
      // Get the HTTP channel details
      var status = httpChannel.responseStatus;
      var path = httpChannel.URI.path;
      
      this._log("connection phase = " + this._connectionPhase);
      this._log("http URI path = " + path);
      this._log("http response status = " + status)
      this._log("data = " + aData);
      
      if (status === null || status !== 200) // Bad status
      {
        // Server error, try again in 30 seconds
        this._setRetryError(Components.interfaces.gmIService.STATE_ERROR_NETWORK);
      }
      else if (SIDResetRegExp.test(path) && aData.indexOf("accounts/SetSID?") != -1)
      {
        this._log("SID reset required; redirecting...");
        let parser = Cc["@mozilla.org/xmlextras/domparser;1"]
                       .createInstance(Ci.nsIDOMParser)
                       .QueryInterface(Ci.nsIDOMParserJS);
        parser.init(null, httpChannel.URI, httpChannel.originalURI);
        let doc = parser.parseFromString('<html xmlns="http://www.w3.org/1999/xhtml">' +
                  aData.match(/<meta[^>]+>/)[0] +
                  '</meta></html>', "text/xml");
        let url = doc.querySelector("meta").getAttribute("content").match(/url=['"](.*?)['"]/)[1];
        this._log("url: " + url);
        this._serverRequest(url, aObserver._inputData);
        return;
      }
      else if (loginRegExp.test(path)) // Bad password
      {
        // Password error, lets just give up
        this.logout(Components.interfaces.gmIService.STATE_ERROR_PASSWORD);
      }
    } catch(e) {
      // Network error, try again in 30 seconds
      this._setRetryError(Components.interfaces.gmIService.STATE_ERROR_NETWORK);
    }
    
    // Only continue if we're still checking!
    if (this.checking)
    {
      const globalsRegExp = /var\s+GLOBALS\s*=/i;
      const viewDataRegExp = /var\s+VIEW_DATA\s*=/i;
      
      var isLatest = (globalsRegExp.test(aData) && viewDataRegExp.test(aData));
      
      if (isLatest)
      {
        this._log("Using the latest Gmail version =)");
        this._connectionPhase = 2;
      }
      else
        this._log("Using the old Gmail version =(");
      
      // Ok, everything looks good so far =)
      switch (++this._connectionPhase)
      {
        case 1:
        {
          // Send the server request
          this._serverRequest(this._checkURL + "ui=2");
          break;
        }
        case 2:
        {
          // Send the server request
          this._serverRequest(this._checkURL + "ui=1&view=tl&search=inbox&start=0&init=1");
          break;
        }
        case 3:
        {
          // Try to get the account information...
          
          try {
            // Quota
            var quMatches = JSON.fromString(aData.match(/\["qu",(.|\s)+?]/)[0]);
            this._log("\"qu\" match was " + (quMatches ? "found" : "not found"));
            
            this._spaceUsed = quMatches[1];
            this._totalSpace = quMatches[2];
            this._percentUsed = quMatches[3];
            
            this._log("space used = " + this.spaceUsed);
            this._log("total space = " + this.totalSpace);
            this._log("percent used = " + this.percentUsed);
          } catch(e) {
            this._log("Error getting the quota: " + e);
          }
          
          try {
            // Initialize the labels
            this._labels = new Array();
            
            // Check which Gmail version
            if (isLatest)
            {
              // Figure out the unread counts
              var ldMatches = JSON.fromString(aData.match(/\["ld",(.|\s)+?(\[|])(\s*]){2}/)[0]);
              this._log("\"ld\" match was " + (ldMatches ? "found" : "not found"));
             
              // Special labels: inbox, drafts, spam
              ldMatches[1].forEach(function(bucket) {
                const K_LABEL_MAP = {"^i": "_inboxUnread",
                                     "^r": "_savedDrafts",
                                     "^s": "_spamUnread"};
                if (bucket[0] in K_LABEL_MAP) {
                  // this is a special label we care about
                  this[K_LABEL_MAP[bucket[0]]] = Math.max(0, bucket[1]);
                }
              }, this);
              
              // Normal labels
              ldMatches[2].forEach(function(bucket) {
                this._labels.push({
                  "name" : bucket[0], 
                  "unread" : bucket[1], 
                  "total" : bucket[2]
                });
              }, this);
            }
            else
            {
              // Inbox/Drafts/Spam
              var dsMatches = JSON.fromString(aData.match(/\["ds",(.|\s)+?](\s*]){2}/)[0]);
              this._log("\"ds\" match was " + (dsMatches ? "found" : "not found"));
              
              with (Math)
              {
                this._inboxUnread = max(0, dsMatches[1][0][1]);
                this._savedDrafts = max(0, dsMatches[1][1][1]);
                this._spamUnread = max(0, dsMatches[1][2][1]);
              }
              
              // Labels
              var ctMatches = JSON.fromString(aData.match(/\["ct",(.|\s)+?](\s*]){2}/)[0]);
              this._log("\"ct\" match was " + (ctMatches ? "found" : "not found"));
              
              for (var i = 0; i < ctMatches[1].length; i++)
              {
                this._labels.push({
                  "name" : ctMatches[1][i][0], 
                  "unread" : ctMatches[1][i][1], 
                  "total" : -1
                });
              }
            }
            
            this._log("inboxUnread = " + this.inboxUnread);
            this._log("savedDrafts = " + this.savedDrafts);
            this._log("spamUnread = " + this.spamUnread);
            
            if (this._labels.length > 0)
            {
              this._log(this._labels.length + " labels(s) were found");
              
              for (var i = 0; i < this._labels.length; i++)
              {
                var label = this._labels[i];
                this._log(label.name + " (" + label.unread + (label.total > 0 ? " of " + label.total : "") + ")");
              }
            }
            else
              this._log("no labels were found");
          } catch(e) {
            this._log("Error getting the unread counts: " + e);
          }
          
          try {
            // Initialize the snippets
            this._snippets = new Array();
            
            // Check which Gmail version
            if (isLatest)
            {
              // Snippets
              var tbRE = /\["tb",0,(\[(?:\[(?:.|\s)+?\n\])*\n\])\n]/g;
              var tbMatches = tbRE.exec(aData);
              this._log("\"tb\" match was " + (tbMatches ? "found" : "not found"));
              
              // with multiple inboxes and priority inbox, we now need to loop
              // over multiple "tb" matches and take all of them into account
              while (tbMatches && tbMatches.length > 1)
              {
                var snippets = JSON.fromString(tbMatches[1]);

                for (var j = 0; j < snippets.length; j++)
                {
                  // Check if the snippet is unread
                  if (snippets[j][3] == 0)
                  {
                    this._snippets.push({
                      "id" : snippets[j][0], 
                      "unread" : true, 
                      "from" : this._replaceHtmlCodes(this._stripHtml(snippets[j][7])), 
                      "subject" : this._replaceHtmlCodes(this._stripHtml(snippets[j][9])), 
                      "msg" : this._replaceHtmlCodes(this._stripHtml(snippets[j][10])), 
                      "time" : this._replaceHtmlCodes(this._stripHtml(snippets[j][14])), 
                      "date" : snippets[j][15]
                    });
                  }
                }
                tbMatches = tbRE.exec(aData);
                this._log("\"tb\" match was " + (tbMatches ? "found" : "not found"));
              }
            }
            else
            {
              // Snippets
              var tMatches = aData.match(/\["t",(.|\s)+?]\s*]/g);
              this._log("\"t\" match was " + (tMatches ? "found" : "not found"));
              
              if (tMatches === null)
                tMatches = new Array();
              
              for (var i = 0; i < tMatches.length; i++)
              {
                var snippets = JSON.fromString(tMatches[i]);
                
                for (var j = 1; j < snippets.length; j++)
                {
                  // Check if the snippet is unread
                  if (snippets[j][1] == 1)
                  {
                    this._snippets.push({
                      "id" : snippets[j][0], 
                      "unread" : true, 
                      "from" : this._replaceHtmlCodes(this._stripHtml(snippets[j][4])),
                      "subject" : this._replaceHtmlCodes(this._stripHtml(snippets[j][6])),
                      "msg" : this._replaceHtmlCodes(this._stripHtml(snippets[j][7])),
                      "time" : this._replaceHtmlCodes(this._stripHtml(snippets[j][3])),
                      "date" : snippets[j][12]
                    });
                  }
                }
              }
            }
            
            if (this._snippets.length > 0)
            {
              this._log(this._snippets.length + " snippet(s) were found");
              
              for (var i = 0; i < this._snippets.length; i++)
              {
                var snippet = this._snippets[i];
                
                this._log("snippet[" + i + "].id = " + snippet.id);
                this._log("snippet[" + i + "].unread = " + snippet.unread);
                this._log("snippet[" + i + "].from = " + snippet.from);
                this._log("snippet[" + i + "].subject = " + snippet.subject);
                this._log("snippet[" + i + "].msg = " + snippet.msg);
                this._log("snippet[" + i + "].time = " + snippet.time);
                this._log("snippet[" + i + "].date = " + snippet.date);
              }
            }
            else
              this._log("no snippets were found");
          } catch(e) {
            this._log("Error getting the snippets: " + e);
          }
          
          this._loggedIn = true;
          this._setChecking(false);
          this._setStatus(Components.interfaces.gmIService.STATE_LOGGED_IN);
          
          break;
        }
      }
    }
  },
  
  _stripHtml: function(aData)
  {
    try {
      return aData.replace(/(<([^>]+)>)/ig, "");
    } catch(e) {
      this._log("Error stripping the HTML data: " + e);
      return aData;
    }
  },
  
  _replaceHtmlCodes: function(aData)
  {
    var htmlCodes = new Array(
      ["&gt;", ">"], ["&lt;", "<"], ["&#39;", "'"], ["&quot;", "\""],
      ["&amp;", "&"], ["&tilde;", "~"], ["&trade;", "?"], ["&copy;", "?"],
      ["&reg;", "?"], ["&hellip;", ""] );
    
    for (var i = 0; i < htmlCodes.length; i++)
    {
      try {
        var regExp = new RegExp(htmlCodes[i][0], "g");
        aData = aData.replace(regExp, htmlCodes[i][1]);
      } catch(e) {
        this._log("Error replacing the HTML codes: " + e);
      }
    }
    
    return aData;
  },
  
  observer: function(aThis, aInputData)
  {
    return ({
      _data: "",
      _inputData: aInputData,
      
      /**
       * nsIStreamListener
       */
      onStartRequest: function(aRequest, aContext) {
        this._data = "";
      },
      
      onStopRequest: function(aRequest, aContext, aStatus) {
        aThis.callback(this._data, aRequest, this);
      },
      
      onDataAvailable: function(aRequest, aContext, aStream, aSourceOffset, aLength) {
        var scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"]
                                      .createInstance(Ci.nsIScriptableInputStream);
        scriptableInputStream.init(aStream);
        this._data += scriptableInputStream.read(aLength);
      },
      
      /**
       * nsIChannelEventSink
       */
      onChannelRedirect: function (aOldChannel, aNewChannel, aFlags) {
        aThis._channel = aNewChannel;
      },

      asyncOnChannelRedirect: function (aOldChannel, aNewChannel, aFlags, aCallback) {
        aThis._channel = aNewChannel;
        aCallback.onRedirectVerifyCallback(Components.results.NS_OK);
      },
      
      /**
       * nsIProgressEventSink
       */
      onProgress: function (aRequest, aContext, aProgress, aProgressMax) { /* Stub */ },
      onStatus: function (aRequest, aContext, aStatus, aStatusArg) { /* Stub */ },
      
      /**
       * nsIHttpEventSink
       */
      onRedirect: function (aOldChannel, aNewChannel) { /* Stub */ },
      
      /**
       * nsIInterfaceRequestor
       */
      getInterface: function(aIID) {
        try {
          return this.QueryInterface(aIID);
        } catch(e) {
          throw Components.results.NS_NOINTERFACE;
        }
      },
      
      QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener,
                                             Ci.nsIChannelEventSink,
                                             Ci.nsIProgressEventSink,
                                             Ci.nsIHttpEventSink,
                                             Ci.nsIInterfaceRequestor])
    });
  },
  
  QueryInterface: XPCOMUtils.generateQI([Ci.gmIServiceGmail,
                                         Ci.gmIService,
                                         Ci.nsIObserver]),
  classID: Components.ID("{b07df9d0-f7dd-11da-974d-0800200c9a66}"),
  classDescription: "Gmail Account Service",
  contractID: "@longfocus.com/gmanager/service/gmail;1"
}

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([gmServiceGmail]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([gmServiceGmail]);
}

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla code.
 *
 * The Initial Developer of the Original Code is
 * Simon Bünzli <zeniko@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2006-2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Utilities for JavaScript code to handle JSON content.
 * See http://www.json.org/ for comprehensive information about JSON.
 *
 * Import this module through
 *
 * Components.utils.import("resource://gre/modules/JSON.jsm");
 *
 * Usage:
 *
 * var newJSONString = JSON.toString( GIVEN_JAVASCRIPT_OBJECT );
 * var newJavaScriptObject = JSON.fromString( GIVEN_JSON_STRING );
 *
 * Note: For your own safety, Objects/Arrays returned by
 *       JSON.fromString aren't instanceof Object/Array.
 */

var EXPORTED_SYMBOLS = ["JSON"];

// The following code is a loose adaption of Douglas Crockford's code
// from http://www.json.org/json.js (public domain'd)

// Notable differences:
// * Unserializable values such as |undefined| or functions aren't
//   silently dropped but always lead to a TypeError.
// * An optional key blacklist has been added to JSON.toString

var JSON = {
  /**
   * Converts a JavaScript object into a JSON string.
   *
   * @param aJSObject is the object to be converted
   * @param aKeysToDrop is an optional array of keys which will be
   *                    ignored in all objects during the serialization
   * @return the object's JSON representation
   *
   * Note: aJSObject MUST not contain cyclic references.
   */
  toString: function JSON_toString(aJSObject, aKeysToDrop) {
    // we use a single string builder for efficiency reasons
    var pieces = [];
    
    // this recursive function walks through all objects and appends their
    // JSON representation (in one or several pieces) to the string builder
    function append_piece(aObj) {
      if (typeof aObj == "string") {
        aObj = aObj.replace(/[\\"\x00-\x1F\u0080-\uFFFF]/g, function($0) {
          // use the special escape notation if one exists, otherwise
          // produce a general unicode escape sequence
          switch ($0) {
          case "\b": return "\\b";
          case "\t": return "\\t";
          case "\n": return "\\n";
          case "\f": return "\\f";
          case "\r": return "\\r";
          case '"':  return '\\"';
          case "\\": return "\\\\";
          }
          return "\\u" + ("0000" + $0.charCodeAt(0).toString(16)).slice(-4);
        });
        pieces.push('"' + aObj + '"')
      }
      else if (typeof aObj == "boolean") {
        pieces.push(aObj ? "true" : "false");
      }
      else if (typeof aObj == "number" && isFinite(aObj)) {
        // there is no representation for infinite numbers or for NaN!
        pieces.push(aObj.toString());
      }
      else if (aObj === null) {
        pieces.push("null");
      }
      // if it looks like an array, treat it as such - this is required
      // for all arrays from either outside this module or a sandbox
      else if (aObj instanceof Array ||
               typeof aObj == "object" && "length" in aObj &&
               (aObj.length === 0 || aObj[aObj.length - 1] !== undefined)) {
        pieces.push("[");
        for (var i = 0; i < aObj.length; i++) {
          arguments.callee(aObj[i]);
          pieces.push(",");
        }
        if (aObj.length > 0)
          pieces.pop(); // drop the trailing colon
        pieces.push("]");
      }
      else if (typeof aObj == "object") {
        pieces.push("{");
        for (var key in aObj) {
          // allow callers to pass objects containing private data which
          // they don't want the JSON string to contain (so they don't
          // have to manually pre-process the object)
          if (aKeysToDrop && aKeysToDrop.indexOf(key) != -1)
            continue;
          
          arguments.callee(key.toString());
          pieces.push(":");
          arguments.callee(aObj[key]);
          pieces.push(",");
        }
        if (pieces[pieces.length - 1] == ",")
          pieces.pop(); // drop the trailing colon
        pieces.push("}");
      }
      else {
        throw new TypeError("No JSON representation for this object!");
      }
    }
    append_piece(aJSObject);
    
    return pieces.join("");
  },

  /**
   * Converts a JSON string into a JavaScript object.
   *
   * @param aJSONString is the string to be converted
   * @return a JavaScript object for the given JSON representation
   */
  fromString: function JSON_fromString(aJSONString) {
    if (!this.isMostlyHarmless(aJSONString))
      throw new SyntaxError("No valid JSON string!");
    
    var s = new Components.utils.Sandbox("about:blank");
    return Components.utils.evalInSandbox("(" + aJSONString + ")", s);
  },

  /**
   * Checks whether the given string contains potentially harmful
   * content which might be executed during its evaluation
   * (no parser, thus not 100% safe! Best to use a Sandbox for evaluation)
   *
   * @param aString is the string to be tested
   * @return a boolean
   */
  isMostlyHarmless: function JSON_isMostlyHarmless(aString) {
    const maybeHarmful = /[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/;
    const jsonStrings = /"(\\.|[^"\\\n\r])*"/g;
    
    return !maybeHarmful.test(aString.replace(jsonStrings, ""));
  }
};