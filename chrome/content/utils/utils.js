// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

if (String.prototype.trim === undefined)
{
  String.prototype.trim = function()
  {
    return this.replace(/^\s+|\s+$/g, "");
  }
}

if (String.prototype.startsWith === undefined)
{
  String.prototype.startsWith = function(str)
  {
    return (this.search("^" + str) > -1);
  }
}

if (String.prototype.endsWith === undefined)
{
  String.prototype.endsWith = function(str)
  {
    return (this.search(str + "$") > -1);
  }
}

var gmanager_Utils = new function()
{
  this.WEBSITE = "http://www.longfocus.com/firefox/gmanager/";
  
  this.init = function()
  {
    // Load the services
    this._logger = Components.classes["@longfocus.com/gmanager/logger;1"].getService(Components.interfaces.gmILogger);
  }
  
  this.getBrowser = function()
  {
    var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
    var window = windowMediator.getMostRecentWindow("navigator:browser");
    
    if (window && typeof window.getBrowser == "function")
      return window.getBrowser();
    else if (typeof getBrowser == "function")
      return getBrowser();
    
    return null;
  }
  
  this.getToolbars = function()
  {
    var allToolbars = new Array();
    var toolbarNames = new Array("statusbar", "toolbar");
    
    for (var i = 0; i < toolbarNames.length; i++)
    {
      var toolbars = this.getBrowser().ownerDocument.getElementsByTagName(toolbarNames[i]);
      for (var k = 0; k < toolbars.length; k++)
        allToolbars.push(toolbars[k]);
    }
    
    return allToolbars;
  }
  
  this.getAccountToolbars = function()
  {
    var accountToolbars = new Array();
    var statusbarpanels = this.getBrowser().ownerDocument.getElementsByTagName("statusbarpanel");
    
    for (var i = 0; i < statusbarpanels.length; i++)
    {
      var statusbarpanel = statusbarpanels.item(i);
      
      if (this.isAccountToolbar(statusbarpanel))
        accountToolbars.push(statusbarpanel);
    }
    
    return accountToolbars;
  }
  
  this.isAccountToolbar = function(aNode)
  {
    if (aNode && aNode.hasAttribute("id"))
      return (aNode.getAttribute("id").indexOf("gmanager-toolbar-panel") == 0);
    return false;
  }
  
  this.getStoredPassword = function(aSite, aUsername)
  {
    var password = null;
    
    // Check for Toolkit 1.9 (Firefox 3)
    if ("@mozilla.org/login-manager;1" in Components.classes)
    {
      // Load the login manager service
      var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
      
      // Get all logins that match the site
      var logins = loginManager.findLogins({}, aSite, "/", null);
      
      // Search for the matching login info
      for (var i = 0; i < logins.length && password === null; i++)
      {
        if (logins[i].username == aUsername)
          password = logins[i].password;
      }
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
        passwordManager.findPasswordEntry(aSite, aUsername, null, hostURIFound, usernameFound, passwordFound);
      } catch(e) {}
      
      // Check if the password was found
      if (passwordFound)
        password = passwordFound.value;
    }
    
    return password;
  }
  
  this.getStoredPasswords = function()
  {
    var passwords = new Array();
    
    // Check for Toolkit 1.9 (Firefox 3)
    if ("@mozilla.org/login-manager;1" in Components.classes)
    {
      // Get the login manager
      var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
      
      // Get all logins that match the hostname
      var loginInfos = loginManager.findLogins({}, "https://www.google.com", "https://www.google.com", null);
      
      for (var i = 0; i < loginInfos.length; i++)
      {
        var password = new Object();
        
        password.user = loginInfos[i].username;
        password.password = loginInfos[i].password;
        
        if (password.user.indexOf("@") == -1)
          password.user += "@gmail.com";
        
        passwords.push(password);
      }
    }
    else
    {
      // Get the password manager enumerator
      var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].getService(Components.interfaces.nsIPasswordManager);
      var passwordEnumerator = passwordManager.enumerator;
      
      while (passwordEnumerator.hasMoreElements())
      {
        var password = passwordEnumerator.getNext().QueryInterface(Components.interfaces.nsIPassword);
        
        if (password.host == "https://www.google.com")
          passwords.push(password);
      }
    }
    
    return passwords;
  }
  
  this.getHref = function(aNode)
  {
    var href = null;
    var link = null;
    var target = aNode;
    
    while (target)
    {
      try {
        if ((target instanceof HTMLAnchorElement && target.href) ||
            target instanceof HTMLAreaElement ||
            target instanceof HTMLLinkElement ||
            (("getAttributeNS" in target) &&
             target.getAttributeNS("http://www.w3.org/1999/xlink", "type") == "simple"))
          link = target;
      } catch(e) {}
      target = target.parentNode;
    }
    
    if (link)
    {
      href = link.href;
      if (!href)
        href = link.getAttribute("http://www.w3.org/1999/xlink", "href");
    }
    
    return (href == null ? "" : href);
  }
  
  this.isMailtoLink = function(aHref)
  {
    return (aHref ? aHref.indexOf("mailto:") == 0 : false);
  }
  
  this.isWindow = function(aName)
  {
    var windowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
    return (windowWatcher.getWindowByName(aName, null) != null);
  }
  
  this.toStyleStatus = function(aStatus)
  {
    var status = "unknown";
    
    switch (aStatus)
    {
      case Components.interfaces.gmIService.STATE_CONNECTING:
        status = "connecting";
        break;
      case Components.interfaces.gmIService.STATE_LOGGED_OUT:
        status = "logged-out";
        break;
      case Components.interfaces.gmIService.STATE_LOGGED_IN:
        status = "logged-in";
        break;
      case Components.interfaces.gmIService.STATE_ERROR_PASSWORD:
      case Components.interfaces.gmIService.STATE_ERROR_NETWORK:
      case Components.interfaces.gmIService.STATE_ERROR_TIMEOUT:
        status = "error";
        break;
    }
    
    return status;
  }
  
  this.toUnicode = function(aString)
  {
    try {
      var unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      unicodeConverter.charset = "UTF-8";
      return unicodeConverter.ConvertToUnicode(aString);
    } catch(e) {
      this._logger.log("Error converting to unicode: " + e);
      return aString;
    }
  }
  
  this.clearKids = function(aPopup)
  {
    if (aPopup)
    {
      while (aPopup.hasChildNodes())
        aPopup.removeChild(aPopup.lastChild);
    }
  }
  
  this.loadSimpleURI = function(aUrl)
  {
    var manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
    this.loadURI(aUrl, gmanager_Utils.WEBSITE + manager.version + "/", null, "background");
  }
  
  this.loadURI = function(aUrl, aReferrerUrl, aData, aLocation)
  {
    var mimeInputStream = Components.classes["@mozilla.org/network/mime-input-stream;1"].createInstance(Components.interfaces.nsIMIMEInputStream);
    var tabbrowser = this.getBrowser();
    var referrerUri = null;
    
    mimeInputStream.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    if (aReferrerUrl != undefined && typeof aData === "string")
    {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"].createInstance(Components.interfaces.nsIIOService);
      referrerUri = ioService.newURI(aReferrerUrl, null, null);
    }
    
    if (aData != undefined && typeof aData === "string")
    {
      var stringInputStream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
      stringInputStream.setData(aData, aData.length);
      
      mimeInputStream.addContentLength = true;
      mimeInputStream.setData(stringInputStream);
    }
    
    switch (aLocation)
    {
      case "blank":
      case "existing":
      {
        var host = (aLocation == "blank" ? "" : "mail.google.com");
        var browsers = tabbrowser.browsers;
        var thebrowser = null;
        
        for (var i = 0; i < browsers.length && thebrowser === null; i++)
        {
          var browser = browsers[i];
          if (browser.currentURI.asciiHost == host)
            thebrowser = browser;
        }
        
        if (thebrowser)
          thebrowser.webNavigation.loadURI(aUrl, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE, referrerUri, mimeInputStream, null);
        else
          this.loadURI(aUrl, aReferrerUrl, aData, "background");
        
        break;
      }
      case "current":
        tabbrowser.webNavigation.loadURI(aUrl, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE, referrerUri, mimeInputStream, null);
        break;
      case "focused":
        tabbrowser.selectedTab = tabbrowser.addTab();
        tabbrowser.webNavigation.loadURI(aUrl, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE, referrerUri, mimeInputStream, null);
        break;
      case "background":
        var newTab = tabbrowser.getBrowserForTab(tabbrowser.addTab());
        newTab.webNavigation.loadURI(aUrl, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE, referrerUri, mimeInputStream, null);
        break;
      case "window":
        window.openDialog("chrome://browser/content", "_blank", "chrome,all,dialog=no", aUrl, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE, referrerUri, mimeInputStream);
        break;
      default:
        break;
    }
  }
  
  this.loadDefaultMail = function(aHref)
  {
    var externalProtocolService = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
    
    if (externalProtocolService)
    {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
      var uri = ioService.newURI((aHref && aHref.startsWith("mailto:") ? aHref : "mailto:"), null, null);
      
      externalProtocolService.loadUrl(uri);
    }
  }
  
  this.init();
}