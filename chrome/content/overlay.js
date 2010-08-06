// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

function gmanager_OverlayLoad(aEvent)
{
  // Load the overlay
  gmanager_Overlay.load();
}

function gmanager_OverlayUnload(aEvent)
{
  // Unload the overlay
  gmanager_Overlay.unload();
}

function gmanager_ContentAreaClick(aEvent)
{
  // Load the accounts manager
  var manager = Components.classes["@longfocus.com/gmanager/manager;1"]
                                  .getService(Components.interfaces.gmIManager);
  var global = manager.global;
  var href = gmanager_Utils.getHref(aEvent.target);
  
  switch (aEvent.button)
  {
    case 0: // Left Click
    case 1: // Middle Click
      var isCompose = global.getBoolPref("compose-mailto-links");
      
      if (isCompose && gmanager_Utils.isMailtoLink(href))
      {
        var email = global.getCharPref("compose-mailto-default");
        var location = global.getCharPref("compose-tab-location");
        
        gmanager_Accounts.loadCompose(email, location, href);
        
        // Prevent the default mail client from loading
        aEvent.preventDefault();
      }
      break;
    case 2: // Right Click
    {
      var isHidden = global.getBoolPref("general-hide-context-menu");
      
      if (!isHidden && !gmanager_Utils.isMailtoLink(href))
        isHidden = global.getBoolPref("compose-context-menu");
      
      document.getElementById("gmanager-context-menu-separator").hidden = isHidden;
      document.getElementById("gmanager-context-menu").hidden = isHidden;
      
      break;
    }
    default:
      break;
  }
}

var gmanager_Overlay = new function()
{
  this.load = function gmanager_Overlay_load()
  {
    // Load the logger service
    this._logger = Components.classes["@longfocus.com/gmanager/logger;1"]
                             .getService(Components.interfaces.gmILogger);
    
    // Load the accounts manager
    this._manager = Components.classes["@longfocus.com/gmanager/manager;1"]
                              .getService(Components.interfaces.gmIManager);
    
    // Load the observers
    var observer = Components.classes["@mozilla.org/observer-service;1"]
                             .getService(Components.interfaces.nsIObserverService);
    observer.addObserver(this, gmanager_Prefs.NOTIFY_CHANGED, false);
    observer.addObserver(this, gmanager_Accounts.NOTIFY_STATE, false);
    
    // Check for new version
    if (this._manager.version != gmanager_Prefs.getCharPref("version"))
      this._welcome();
    
    // Load the mail accounts
    this._loadAccounts(true);
    
    // Toggle the Tools Menu
    this._toggleToolsMenu();
  }
  
  this.unload = function()
  {
    var observer = Components.classes["@mozilla.org/observer-service;1"]
                             .getService(Components.interfaces.nsIObserverService);
    try {
      // Remove the observers
      observer.removeObserver(this, gmanager_Prefs.NOTIFY_CHANGED);
      observer.removeObserver(this, gmanager_Accounts.NOTIFY_STATE);
    } catch(e) {
      this._logger.log("Error removing the observers!");
    }
  }
  
  this._welcome = function()
  {
    // Get the previous version
    var version = gmanager_Prefs.getCharPref("version");
    
    this._logger.log("Previous version = " + version);
    
    if (version < "0.5")
    {
      var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                  .getService(Components.interfaces.nsIPrefService);
      var prefBranch = prefService.getBranch("gmanager.");
      
      if (prefBranch.prefHasUserValue("accounts"))
      {
        var accounts = prefBranch.getCharPref("accounts").split(",");
        
        for (var i = 0; i < accounts.length; i++)
        {
          var email = accounts[i] + "@gmail.com";
          
          if (!this._manager.isAccount(email))
          {
            var password =
              gmanager_Utils.getStoredPassword("gmanager.gmail.account",
                                               accounts[i]);

            this._logger.log("Migrating email: " + email);

            this._manager.addAccount("gmail", email, email, password, null);
          }
        }
        
        // Save the accounts
        this._manager.save();
      }
      
      if (prefBranch.prefHasUserValue("current"))
      {
        var current = prefBranch.getCharPref("current").split(",")[0];
        gmanager_Prefs.setCharPref("current", current);
      }
    }
    
    if (version < "0.6")
    {
      if (gmanager_Prefs.hasPref("current"))
      {
        var current = gmanager_Prefs.getCharPref("current");
        var account = this._manager.getAccount(current);
        
        // Set the account to be displayed
        account.setBoolPref("toolbar-display", true);
        
        // Save the accounts
        this._manager.save();
      }
    }
    
    // Check if this is the first time the extension has run
    if (gmanager_Prefs.getBoolPref("first-time"))
    {
      var passwords = gmanager_Utils.getStoredPasswords();
      
      // Open the migrate window if any passwords exist
      if (passwords && passwords.length > 0)
        window.openDialog("chrome://gmanager/content/migrate/migrate.xul",
                          "migrate",
                          "centerscreen,chrome,resizable=yes",
                          passwords);
      
      // Mark the extension as having already run
      gmanager_Prefs.setBoolPref("first-time", false);
    }
    
    this._logger.log("Current version = " + this._manager.version);
    
    // Set the current version
    gmanager_Prefs.setCharPref("version", this._manager.version);
  }
  
  this._loadAccounts = function gmanager_Overlay__loadAccounts(aInit)
  {
    var accounts = this._manager.getAccounts({});
    var isAutoLogin = this._manager.global.getBoolPref("general-auto-login");
    var theToolbarPanel = document.getElementById("gmanager-toolbar-panel");
    var activeToolbarPanels = 0;
    
    for (var i = 0; i < accounts.length; i++)
    {
      var account = accounts[i];
      var toolbarPanel = document.getElementById("gmanager-toolbar-panel-" + account.email);
      
      // Check if the toolbar panel exists
      if (toolbarPanel)
      {
        toolbarPanel.updateDisplay();
        toolbarPanel.updatePosition();
      }
      else
      {
        toolbarPanel = theToolbarPanel.cloneNode(true);
        toolbarPanel.account = account;
        toolbarPanel.displayAccount = account;
      }
      
      if (!toolbarPanel.hidden)
        activeToolbarPanels++;
      
      // Check if the account should automatically login
      if (aInit &&
          !account.loggedIn &&
          (isAutoLogin || account.getBoolPref("general-auto-login")))
      {
        account.login(null);
      }
    }
    
    if (gmanager_Prefs.hasPref("current"))
    {
      var current = gmanager_Prefs.getCharPref("current");
      
      if (this._manager.isAccount(current))
        theToolbarPanel.displayAccount = this._manager.getAccount(current);
    }
    
    // Display the main toolbar panel if no account toolbar panels are displayed
    theToolbarPanel.hidden = (activeToolbarPanels > 0);
    
    var toolbarPanels = gmanager_Utils.getAccountToolbars();
    
    for (var i = 0; i < toolbarPanels.length; i++)
    {
      var toolbarPanel = toolbarPanels[i];
      
      if (toolbarPanel.account)
      {
        var email = toolbarPanel.account.email;
        
        if (!this._manager.isAccount(email))
          toolbarPanel.destroy();
      }
    }
  }
  
  this._toggleToolsMenu = function()
  {
    // Display the Tools Menu
    var toolsMenu = document.getElementById("gmanager-tools-menu");
    if (toolsMenu)
      toolsMenu.collapsed = this._manager.global.getBoolPref("general-hide-tools-menu");
  }
  
  this.observe = function(aSubject, aTopic, aData)
  {
    this._logger.log("aSubject = " + aSubject);
    this._logger.log("aTopic = " + aTopic);
    this._logger.log("aData = " + aData);
    
    if (aTopic == gmanager_Prefs.NOTIFY_CHANGED)
    {
      // aSubject : null
      // aTopic   : gmanager_Prefs.NOTIFY_CHANGED
      // aData    : null
      
      // Load the mail accounts
      this._loadAccounts(false);
      
      // Toggle the Tools Menu
      this._toggleToolsMenu();
    }
    else if (aTopic == gmanager_Accounts.NOTIFY_STATE)
    {
      // aSubject : null
      // aTopic   : gmanager_Accounts.NOTIFY_STATE
      // aData    : email|status (e.g. longfocus@gmail.com|10)
      
      var email = (aData ? aData.split("|")[0] : null);
      var status = parseInt(aData ? aData.split("|")[1] : null);
      var account = this._manager.getAccount(email);
      
      this._logger.log("email = " + email);
      this._logger.log("status = " + status);
      
      // Check if the account exists
      if (account)
      {
        switch (status)
        {
          case Components.interfaces.gmIService.STATE_CONNECTING:
          case Components.interfaces.gmIService.STATE_LOGGED_OUT:
            break;
          case Components.interfaces.gmIService.STATE_LOGGED_IN:
          {
            if (account.newMail)
            {
              // Play sound
              if (account.getBoolPref("notifications-sounds"))
              {
                var file = account.getCharPref("notifications-sounds-file");
                this._logger.log("Playing sound file: " + file);
                gmanager_Sounds.play(file);
              }
              
              // Show snippets
              if (account.getBoolPref("notifications-display-snippets"))
              {
                this._logger.log("Displaying alerts for: " + email);
                gmanager_Alerts.display(email);
              }
            }
            
            break;
          }
          case Components.interfaces.gmIService.STATE_ERROR_PASSWORD:
          {
            var loginWindowName = "gmanager-login-" + account.email;
            
            if (!gmanager_Utils.isWindow(loginWindowName))
              window.openDialog("chrome://gmanager/content/login/login.xul", loginWindowName, "centerscreen,chrome,dependent=no", account);
            
            break;
          }
          case Components.interfaces.gmIService.STATE_ERROR_NETWORK:
          case Components.interfaces.gmIService.STATE_ERROR_TIMEOUT:
            break;
          default:
          {
            this._logger.log("Unknown state...definitely should not be here!");
            break;
          }
        }
      }
    }
  }
}