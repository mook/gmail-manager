// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const Ci = Components.interfaces;
const Cc = Components.classes;

function gmCookies()
{
  // Load the services
  this._cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);
  this._cookieService = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
  this._observer = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  
  // Initialize the sessions
  this._sessions = new Array();
}
gmCookies.prototype = {
  loadSession: function(aHost)
  {
    // Check for host session
    if (this._sessions[aHost] != null)
    {
      // Increment connections
      this._sessions[aHost].count++;
    }
    else
    {
      // Creates host session
      this._sessions[aHost] = new Object();
      this._sessions[aHost].count = 1;
      this._sessions[aHost].cookies = this._getCookies(aHost);
      
      // Load observers
      this._observer.addObserver(this, "cookie-changed", false);
      this._observer.addObserver(this, "http-on-modify-request", false);
      this._observer.addObserver(this, "http-on-examine-response", false);
    }
  },
  
  restoreSession: function(aHost)
  {
    // Check for host session
    if (this._sessions[aHost] != null)
    {
      // Decrement connections
      this._sessions[aHost].count--;
      
      if (this._sessions[aHost].count == 0)
      {
        // Remove observers
        this._observer.removeObserver(this, "cookie-changed");
        this._observer.removeObserver(this, "http-on-modify-request");
        this._observer.removeObserver(this, "http-on-examine-response");
        
        // Restore cookies
        this._putCookies(aHost, this._sessions[aHost].cookies);
        
        // Remove host session
        delete this._sessions[aHost];
      }
    }
  },
  
  _getCookies: function(aHost)
  {
    var iioServ = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
    var cookieEnum = this._cookieManager.enumerator;
    var cookies = new Array();
    
    while (cookieEnum.hasMoreElements())
    {
      var nextCookie = cookieEnum.getNext().QueryInterface(Components.interfaces.nsICookie2);
      
      if (nextCookie.host.indexOf(aHost) > -1)
      {
        var pair = nextCookie.name + "=" + nextCookie.value + ";";
        var type = (nextCookie.isDomain ? "Domain=" : "Host=") + nextCookie.host + ";";
        var path = "Path=" + nextCookie.path + ";";
        var expires = (nextCookie.isSession ? "" : "Expires=" + (new Date(nextCookie.expires * 1000).toGMTString()));
        
        // Creates cookie
        cookies[nextCookie.name] = new Object();
        cookies[nextCookie.name].set = pair + type + path + expires;
        cookies[nextCookie.name].uri = iioServ.newURI("http://" + nextCookie.rawHost, "UTF-8", null);
        cookies[nextCookie.name].value = nextCookie.value;
      }
    }
    
    return cookies;
  },
  
  _putCookies: function(aHost, aCookies)
  {
    var cookieEnum = this._cookieManager.enumerator;
    
    // Clear host cookies
    while (cookieEnum.hasMoreElements())
    {
      var cookie = cookieEnum.getNext().QueryInterface(Components.interfaces.nsICookie2);
      var remove = (cookie.name in aCookies ? cookie.value != aCookies[cookie.name].value : true);
      
      if (cookie.host.indexOf(aHost) > -1 && remove)
        this._cookieManager.remove(cookie.host, cookie.name, cookie.path, false);
    }
    
    // Restore host cookies
    for (var name in aCookies)
      this._cookieService.setCookieString(aCookies[name].uri, null, aCookies[name].set, null);
  },
  
  _inSessions: function(aHost)
  {
    var host = null;
    
    for (var lookupHost in this._sessions)
      if (aHost.indexOf(lookupHost) > -1)
        host = lookupHost;
    
    return host;
  },
  
  observe: function(aSubject, aTopic, aData)
  {
    switch (aTopic)
    {
      case "cookie-changed":
      {
        var inCookie = aSubject.QueryInterface(Components.interfaces.nsICookie2);
        var host = this._inSessions(inCookie.host);
        
        if (host != null)
        {
          var myCookie = this._sessions[host].cookies[inCookie.name];
          
          if (myCookie && myCookie.value != inCookie.value)
            this._cookieService.setCookieString(myCookie.uri, null, myCookie.set, null);
        }
        
        break;
      }
      case "http-on-modify-request":
      case "http-on-examine-response":
      {
        var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
        var uri = httpChannel.URI;
        var host = this._inSessions(uri.host);
        var isGood = (uri.originCharset.indexOf("gmanager") == -1 && host != null);
        
        if (aTopic == "http-on-modify-request" && isGood)
        {
          try {
            var session = this._sessions[host];
            
            // Clear any cookies
            httpChannel.setRequestHeader("Cookie", "", false);
            
            for (var name in session.cookies)
            {
              var cookieValue = (session.cookies[name].set.split(";"))[0];
              var cookieHost = session.cookies[name].uri.host;
              
              if (uri.host.indexOf(cookieHost) > -1)
                httpChannel.setRequestHeader("Cookie", cookieValue, true);
            }
          } catch(e) {}
        }
        else if (aTopic == "http-on-examine-response" && isGood)
        {
          try {
            var cookies = httpChannel.getResponseHeader("Set-Cookie").split("\n");
            
            for (var i = 0; i < cookies.length; i++)
            {
              var pair = (cookies[i].split(";"))[0];
              var name = (pair.split("="))[0];
              
              this._sessions[host].cookies[name] = new Object();
              this._sessions[host].cookies[name].set = cookies[i];
              this._sessions[host].cookies[name].uri = uri;
              this._sessions[host].cookies[name].value = (pair.split("="))[1];
            }
          } catch(e) {}
        }
        
        break;
      }
    }
  },
  
  QueryInterface: XPCOMUtils.generateQI([Ci.gmICookies,
                                         Ci.nsIObserver]),
  classID: Components.ID("{81516840-f7dd-11da-974d-0800200c9a66}"),
  classDescription: "Cookie Sessions Manager",
  contractID: "@longfocus.com/gmanager/cookies;1"
}

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([gmCookies]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([gmCookies]);
}
