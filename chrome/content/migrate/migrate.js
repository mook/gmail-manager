// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Migrate = new function()
{
  this.__proto__ = new gmanager_BundlePrefix("gmanager-migrate-");
  
  this.load = function()
  {
    var passwords = null;
    var accountsList = document.getElementById("gmanager-migrate-accounts-listbox");
    
    // Unwrap the window arguments
    if ("arguments" in window && window.arguments.length > 0)
    {
      // window.arguments[0] : passwords
      
      passwords = window.arguments[0];
    }
    
    // Check if the passwords are specified
    if (passwords && passwords.length > 0)
    {
      for (var i = 0; i < passwords.length; i++)
      {
        var accountItem = document.createElement("listitem");
        accountItem.setAttribute("class", "gmanager-migrate-listitem");
        accountItem.setAttribute("email", passwords[i].user);
        accountItem.setAttribute("password", passwords[i].password);
        accountsList.appendChild(accountItem);
      }
    }
    else
    {
      var accountItem = document.createElement("listitem");
      accountItem.setAttribute("label", this.getString("no-accounts"));
      accountsList.setAttribute("disabled", "true");
      accountsList.appendChild(accountItem);
      
      // Disable the login checkbox
      var loginCheckbox = document.getElementById("gmanager-migrate-login-checkbox");
      loginCheckbox.setAttribute("disabled", "true");
      
      // Disable the passwords button
      var passwordsButton = document.getElementById("gmanager-migrate-passwords-button");
      passwordsButton.setAttribute("disabled", "true");
    }
    
    // Toggle the passwords (initially hidden)
    this.togglePasswords();
  }
  
  this.togglePasswords = function()
  {
    var isHidden = document.getElementById("gmanager-migrate-accounts-password-listcol").collapsed;
    document.getElementById("gmanager-migrate-passwords-button").label = (isHidden ? this.getString("hide-passwords") : this.getString("show-passwords"));
    document.getElementById("gmanager-migrate-accounts-password-listcol").collapsed = !isHidden
  }
  
  this.dialogAccept = function()
  {
    var manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
    var isLogin = document.getElementById("gmanager-migrate-login-checkbox").checked;
    var accountItems = document.getElementsByTagName("listitem");
    var isModified = false;
    
    for (var i = 0; i < accountItems.length; i++)
    {
      var accountItem = accountItems[i];
      
      // Check if the account should be added
      if (accountItem.checked)
      {
        var account = manager.addAccount("gmail", accountItem.email, accountItem.email, accountItem.password, null);
        
        isModified = true;
        
        // Check if the account exists and we should login
        if (account && isLogin)
        {
          // Login to the account
          account.login(null);
        }
      }
    }
    
    if (isModified)
    {
      // Save the accounts
      manager.save();
      
      // Notify the observers that preferences have changed
      var observer = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
      observer.notifyObservers(null, "gmanager-prefs-notify-changed", null);
    }
    
    // Close the dialog
    return true;
  }
}