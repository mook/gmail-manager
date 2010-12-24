// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_ToolbarMenu = new function()
{
  this.__proto__ = new gmanager_BundlePrefix("gmanager-toolbar-menu-");
  
  this.init = function()
  {
    // Load the accounts manager
    this._manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
  }
  
  this._createMenuitem = function(aLabel)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", this.getString(aLabel));
    menuitem.setAttribute("accesskey", this.getString(aLabel + "-ak"));
    return menuitem;
  }
  
  this.buildMenu = function(aPopup)
  {
    var accounts = this._manager.getAccounts({});
    var menuitem = null;
    
    // Clear the menu
    gmanager_Utils.clearKids(aPopup);
    
    // Compose Mail
    var composeMenu = document.createElement("menu");
    var composeMenupopup = document.createElement("menupopup");
    composeMenu.setAttribute("label", this.getString("compose-mail"));
    composeMenu.setAttribute("accesskey", this.getString("compose-mail-ak"));
    composeMenupopup.setAttribute("onpopupshowing", "event.stopPropagation(); return gmanager_ToolbarMenu.buildComposeMenu(this);");
    composeMenu.appendChild(composeMenupopup);
    aPopup.appendChild(composeMenu);
    
    // Separator
    aPopup.appendChild(document.createElement("menuseparator"));
    
    // Check if any accounts exist
    if (accounts.length > 0)
    {
      var toolbarPanel = aPopup.parentNode;
      var numLoggedIn = 0;
      
      for (var i = 0; i < accounts.length; i++)
        numLoggedIn += (accounts[i].loggedIn ? 1 : 0);
      
      // Login All Accounts
      menuitem = this._createMenuitem("login-all-accounts");
      menuitem.setAttribute("oncommand", "gmanager_Accounts.loginAllAccounts();");
      menuitem.setAttribute("disabled", (numLoggedIn == accounts.length));
      aPopup.appendChild(menuitem);
      
      // Logout All Accounts
      menuitem = this._createMenuitem("logout-all-accounts");
      menuitem.setAttribute("oncommand", "gmanager_Accounts.logoutAllAccounts();");
      menuitem.setAttribute("disabled", (numLoggedIn == 0));
      aPopup.appendChild(menuitem);
      
      // Check All Accounts
      menuitem = this._createMenuitem("check-all-accounts");
      menuitem.setAttribute("oncommand", "gmanager_Accounts.checkAllAccounts();");
      menuitem.setAttribute("disabled", (numLoggedIn == 0));
      aPopup.appendChild(menuitem);
      
      // Separator
      aPopup.appendChild(document.createElement("menuseparator"));
      
      if (gmanager_Utils.isAccountToolbar(toolbarPanel))
      {
        var panelAccount = toolbarPanel.account;
        var displayAccount = toolbarPanel.displayAccount;
        
        if (displayAccount)
        {
          if (displayAccount.loggedIn)
          {
            // Logout Selected Account
            menuitem = this._createMenuitem("logout-selected-account");
            menuitem.setAttribute("oncommand", "gmanager_Accounts.logoutAccount('" + displayAccount.email + "');");
            aPopup.appendChild(menuitem);
          }
          else
          {
            // Login Selected Account
            menuitem = this._createMenuitem("login-selected-account");
            menuitem.setAttribute("oncommand", "gmanager_Accounts.loginAccount('" + displayAccount.email + "');");
            aPopup.appendChild(menuitem);
          }
          
          // Check Selected Account
          menuitem = this._createMenuitem("check-selected-account");
          menuitem.setAttribute("oncommand", "gmanager_Accounts.checkAccount('" + displayAccount.email + "');");
          menuitem.setAttribute("disabled", !displayAccount.loggedIn);
          aPopup.appendChild(menuitem);
          
          // Display Mail Snippets...
          menuitem = this._createMenuitem("display-snippets");
          menuitem.setAttribute("oncommand", "gmanager_Alerts.display('" + displayAccount.email + "');");
          menuitem.setAttribute("disabled", (!displayAccount.loggedIn && displayAccount.getSnippets({}).length == 0));
          aPopup.appendChild(menuitem);
          
          // Separator
          aPopup.appendChild(document.createElement("menuseparator"));
        }
        
        for (var i = 0; i < accounts.length; i++)
        {
          var account = accounts[i];
          var email = account.email;
          var unread = account.unread;
          
          menuitem = document.createElement("menuitem");
          menuitem.setAttribute("class", "gmanager-toolbar-menuitem");
          menuitem.setAttribute("checked", (displayAccount && displayAccount.email == email));
          menuitem.setAttribute("default", (panelAccount && panelAccount.email == email));
          menuitem.setAttribute("alias", gmanager_Utils.toUnicode(account.alias));
          menuitem.setAttribute("unread", unread);
          menuitem.setAttribute("icontype", account.type);
          menuitem.setAttribute("status", gmanager_Utils.toStyleStatus(account.status));
          menuitem.setAttribute("newMail", unread > 0);
          menuitem.setAttribute("oncommand", "gmanager_ToolbarMenu.switchAccount('" + email + "');");
          
          aPopup.appendChild(menuitem);
        }
        
        // Separator
        aPopup.appendChild(document.createElement("menuseparator"));
      }
    }
    else
    {
      // Login Account...
      menuitem = this._createMenuitem("login-account");
      menuitem.setAttribute("oncommand", "window.openDialog('chrome://gmanager/content/login/login.xul', 'login', 'centerscreen,chrome,modal');");
      aPopup.appendChild(menuitem);
      
      // Separator
      aPopup.appendChild(document.createElement("menuseparator"));
    }
    
    // Visit Homepage
    menuitem = this._createMenuitem("visit-homepage");
    menuitem.setAttribute("oncommand", "gmanager_Utils.loadSimpleURI(gmanager_Utils.WEBSITE);");
    aPopup.appendChild(menuitem);
    
    // Options...
    menuitem = this._createMenuitem("options");
    menuitem.setAttribute("default", "true");
    menuitem.setAttribute("oncommand", "window.openDialog('chrome://gmanager/content/options/options.xul', 'options', 'centerscreen,chrome,modal,resizable');");
    aPopup.appendChild(menuitem);
    
    // Show the menu
    return true;
  }
  
  this.buildComposeMenu = function(aPopup)
  {
    var accounts = this._manager.getAccounts({});
    var menuitem = null;
    
    // Clear the menu
    gmanager_Utils.clearKids(aPopup);
    
    // Default Mail Client
    menuitem = this._createMenuitem("default-client");
    menuitem.setAttribute("oncommand", "gmanager_ToolbarMenu.composeAccount(null);");
    aPopup.appendChild(menuitem);
    
    if (accounts && accounts.length > 0)
    {
      // Separator
      aPopup.appendChild(document.createElement("menuseparator"));
      
      for (var i = 0; i < accounts.length; i++)
      { 
        var email = accounts[i].email;
        menuitem = document.createElement("menuitem");
        menuitem.setAttribute("label", email);
        menuitem.setAttribute("oncommand", "gmanager_ToolbarMenu.composeAccount('" + email + "');");
        aPopup.appendChild(menuitem);
      }
    }
    
    // Show the menu
    return true;
  }
  
  this.composeAccount = function(aEmail)
  {
    var location = this._manager.global.getCharPref("compose-tab-location");
    var href = gmanager_Utils.getHref(document.popupNode);
    
    gmanager_Accounts.loadCompose(aEmail, location, href);
  }
  
  this.switchAccount = function(aEmail)
  {
    var account = this._manager.getAccount(aEmail);
    
    if (account)
    {
      var toolbarPanel = document.popupNode;
      
      if (gmanager_Utils.isAccountToolbar(toolbarPanel))
        toolbarPanel.displayAccount = account;
      
      if (account.loggedIn && this._manager.global.getBoolPref("toolbar-auto-check"))
        account.check();
      else if (!account.loggedIn && this._manager.global.getBoolPref("toolbar-auto-login"))
        account.login(null);
    }
  }
  
  this.init();
}