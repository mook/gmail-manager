// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

// Global account type
const GLOBAL_TYPE = "global";

// Mail account types
const ACCOUNT_TYPE_GMAIL = "gmail";
const ACCOUNT_TYPE_YAHOO = "yahoo";

// Password site
const PASSWORD_SITE = "longfocus.gmanager.account";

function gmAccount()
{
  // Load the services
  this._logger = Components.classes["@longfocus.com/gmanager/logger;1"].getService(Components.interfaces.gmILogger);
  this._timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
}
gmAccount.prototype = {
  _logger: null,
  _node: null,
  _prefs: null,
  _type: null,
  _email: null,
  _alias: null,
  _password: null,
  _service: null,
  
  _log: function(aMsg)
  {
    this._logger.log("(" + this.email + ") " + aMsg);
  },
  
  get node() { return this._node; },
  get type() { return this._type; },
  get email() { return this._email; },
  get alias() { return this._alias; },
  get password()
  {
    var password = null;
    
    // Check for Toolkit 1.9 (Firefox 3)
    if ("@mozilla.org/login-manager;1" in Components.classes)
    {
      // Lookup the login info
      var loginInfo = this._getLoginInfo();
      
      // Check if the login info exists
      if (loginInfo !== null)
        password = loginInfo.password;
    }
    else
    {
      // Load the password manager service
      var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].getService(Components.interfaces.nsIPasswordManagerInternal);
      
      // Initialize the parameters to lookup
      var hostURIFound = { value: "" };
      var usernameFound = { value: "" };
      var passwordFound = { value: "" };
      
      try {
        // Lookup the password for this email
        passwordManager.findPasswordEntry(PASSWORD_SITE, this._email, null, hostURIFound, usernameFound, passwordFound);
      } catch(e) {
        this._log("Error getting the password: " + e);
      }
      
      // Check if the password was found
      if (passwordFound !== null)
        password = passwordFound.value;
    }
    
    // Return the password
    return password;
  },
  
  get newMail() { return this.unread > this._lastUnread; },
  get unread()
  {
    var unread = 0;
    
    if (this.getBoolPref("toolbar-unread-count-inbox"))
      unread += this.inboxUnread;
    
    if (this.getBoolPref("toolbar-unread-count-spam"))
      unread += this.spamUnread;
    
    if (this.getBoolPref("toolbar-unread-count-labels"))
    {
      var labels = this.getLabels({});
      
      for (var i = 0; i < labels.length; i++)
        unread += labels[i].unread;
    }
    
    return unread;
  },
  
  get status() { return (this._service !== null ? this._service.status : null); },
  get loggedIn() { return (this._service !== null ? this._service.loggedIn : false); },
  get checking() { return (this._service !== null ? this._service.checking : false); },
  get inboxUnread() { return (this._service !== null ? this._service.inboxUnread : -1); },
  get savedDrafts() { return (this._service !== null ? this._service.savedDrafts : -1); },
  get spamUnread() { return (this._service !== null ? this._service.spamUnread : -1); },
  get spaceUsed() { return (this._service !== null ? this._service.spaceUsed : null); },
  get percentUsed() { return (this._service !== null ? this._service.percentUsed : null); },
  get totalSpace() { return (this._service !== null ? this._service.totalSpace : null); },
  
  getBoolPref: function(aId)
  {
    return this.getCharPref(aId) == "true" ? true : false;
  },
  setBoolPref: function(aId, aValue)
  {
    this.setCharPref(aId, aValue ? "true" : "false");
  },
  
  getCharPref: function(aId)
  {
    if (aId in this._prefs)
    {
      var value = this._prefs[aId].getAttribute("value");
      this._log("Returning preference: " + aId + " = " + value);
      return value;
    }
    else
      this._log("Unknown preference: " + aId);
  },
  setCharPref: function(aId, aValue)
  {
    if (aId in this._prefs)
      this._prefs[aId].setAttribute("value", aValue);
  },
  
  getIntPref: function(aId)
  {
    return parseInt(this.getCharPref(aId));
  },
  setIntPref: function(aId, aValue)
  {
    this.setCharPref(aId, aValue ? aValue.toString() : "");
  },
  
  load: function(aNode)
  {
    this._node = aNode;
    this._prefs = new Array();
    
    if (this._type === null)
    {
      // Set the account type
      this._type = this._node.getAttribute("type");
      
      // Check the account type
      if (this._type === GLOBAL_TYPE)
      {
        // Set the account email
        this._email = GLOBAL_TYPE;
      }
      else
      {
        // Set the account email
        this._email = this._node.getAttribute("email");
        
        // Load the mail service
        switch (this._type)
        {
          case ACCOUNT_TYPE_GMAIL:
            // Create the Gmail mail service
            this._service = Components.classes["@longfocus.com/gmanager/service/gmail;1"].createInstance(Components.interfaces.gmIServiceGmail);
            break;
          case ACCOUNT_TYPE_YAHOO:
            // Create the Yahoo mail service
            // TODO: Coming soon...
            break;
          default:
            break;
        }
        
        // Initialize the mail service
        this.init(this._email);
      }
    }
    
    // Set the account alias
    this._alias = this._node.getAttribute("alias");
    
    // Check if the password attribute is specified
    if (this._node.hasAttribute("password"))
    {
      // Save the account password
      this.savePassword(this._node.getAttribute("password"));
    }
    
    var prefs = this._node.getElementsByTagName("pref");
    
    for (var i = 0; i < prefs.length; i++)
    {
      var pref = prefs.item(i);
      this._prefs[pref.getAttribute("id")] = pref;
    }
  },
  
  savePassword: function(aPassword)
  {
    // Save the password
    this._updatePassword(aPassword);
  },
  
  removePassword: function()
  {
    // Remove the password (if available)
    this._updatePassword(null);
  },
  
  _updatePassword: function(aPassword)
  {
    var isPassword = (aPassword != null && aPassword.length > 0);
    
    // Check for Toolkit 1.9 (Firefox 3)
    if ("@mozilla.org/login-manager;1" in Components.classes)
    {
      // Load the login manager service
      var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
      
      // Get the available login info
      var loginInfo = this._getLoginInfo();
      
      // Check if the password is specified
      if (isPassword)
      {
        // Create the updated login info
        var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
        var newLoginInfo = new nsLoginInfo(PASSWORD_SITE, "/", null, this._email, aPassword, "", "");
        
        // Check if the login info exists
        if (loginInfo === null)
          loginManager.addLogin(newLoginInfo);
        else
          loginManager.modifyLogin(loginInfo, newLoginInfo);
      }
      else
      {
        // Check if the login info exists
        if (loginInfo !== null)
          loginManager.removeLogin(loginInfo);
      }
    }
    else
    {
      // Load the password manager service
      var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].getService(Components.interfaces.nsIPasswordManager);
      
      try {
        // Check if the password is specified
        if (isPassword)
          passwordManager.addUser(PASSWORD_SITE, this._email, aPassword);
        else
          passwordManager.removeUser(PASSWORD_SITE, this._email);
      } catch(e) {
        this._log("Error updating the password: " + e);
      }
    }
  },
  
  _getLoginInfo: function()
  {
    // Load the login manager service
    var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
    
    // Get all logins that match the site
    var logins = loginManager.findLogins({}, PASSWORD_SITE, "/", null);
    
    // Search for the matching login info
    for (var i = 0; i < logins.length; i++)
    {
      if (logins[i].username === this._email)
        return logins[i];
    }
    
    return null;
  },
  
  /**
   * gmIService
   */
  init: function(aEmail)
  {
    if (this._service !== null)
      this._service.init(aEmail);
  },
  
  getInbox: function(/* Optional */ aPassword)
  {
    if (this._service !== null)
    {
      if (aPassword == null)
        aPassword = this.password;
      
      return this._service.getInbox(aPassword);
    }
  },
  
  getCompose: function(/* Optional */ aPassword, aHref)
  {
    if (this._service !== null)
    {
      if (aPassword == null)
        aPassword = this.password;
      
      return this._service.getCompose(aPassword, aHref);
    }
  },
  
  login: function(/* Optional */ aPassword)
  {
    if (this._service !== null)
    {
      if (aPassword == null)
        aPassword = this.password;
      
      this._lastUnread = 0;
      this._service.login(aPassword);
      this._startTimer();
    }
  },
  
  logout: function()
  {
    if (this._service !== null)
      this._service.logout();
  },
  
  check: function()
  {
    if (this._service !== null)
    {
      this._lastUnread = this.unread;
      this._service.check();
      this._startTimer();
    }
  },
  
  resetUnread: function()
  {
    if (this._service !== null)
    {
      this._service.resetUnread();
      this._startTimer();
    }
  },
  
  getLabels: function(aCount)
  {
    var labels = (this._service !== null ? this._service.getLabels({}) : []);
    aCount.value = labels.length;
    return labels;
  },
  
  getSnippets: function(aCount)
  {
    var snippets = (this._service !== null ? this._service.getSnippets({}) : []);
    aCount.value = snippets.length;
    return snippets;
  },
  
  _startTimer: function()
  {
    // Stop the check timer
    this._timer.cancel();
    
    if (this.getBoolPref("notifications-check"))
    {
      var interval = (this.getIntPref("notifications-check-interval") * 60000);
      
      // Check if the interval is valid
      if (!isNaN(interval) && interval > 0)
      {
        // Start the check timer, fire only once
        this._timer.initWithCallback(this, interval, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
      }
    }
  },
  
  notify: function(aTimer)
  {
    if (this.loggedIn)
      this.check();
  },
  
  QueryInterface: function(iid)
  {
    if (iid.equals(Components.interfaces.gmIAccount) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

var myModule = {
  firstTime: true,
  
  myCID: Components.ID("{d4676ee3-7e3c-455a-b417-37eaea3082ad}"),
  myDesc: "Mail Account",
  myProgID: "@longfocus.com/gmanager/account;1",
  myFactory: {
    createInstance: function(outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      
      return (new gmAccount()).QueryInterface(iid);
    }
  },
  
  registerSelf: function(compMgr, fileSpec, location, type)
  {
    if (this.firstTime) {
      this.firstTime = false;
      throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
    }
    
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(this.myCID, this.myDesc, this.myProgID, fileSpec, location, type);
  },
  
  getClassObject: function(compMgr, cid, iid)
  {
    if (!cid.equals(this.myCID))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    
    if (!iid.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    
    return this.myFactory;
  },
  
  canUnload: function(compMgr) { return true; }
};

function NSGetModule(compMgr, fileSpec) { return myModule; }