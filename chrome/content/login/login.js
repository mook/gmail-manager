// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Login = new function()
{
  this.__proto__ = new gmanager_BundlePrefix("gmanager-login-");
  
  this.load = function()
  {
    // Unwrap the window arguments
    if ("arguments" in window && window.arguments.length >= 1)
    {
      // window.arguments[0] : mail account
      
      this._account = window.arguments[0];
    }
    
    // Check if the account is specified
    if (this._account != undefined)
    {
      var password = this._account.password;
      
      document.getElementById("gmanager-login-email-textbox").disabled = true;
      document.getElementById("gmanager-login-email-textbox").value = this._account.email;
      document.getElementById("gmanager-login-email-textbox").size = this._account.email.length;
      document.getElementById("gmanager-login-password-textbox").value = (password ? password : "");
      document.getElementById("gmanager-login-remember-checkbox").checked = (password && password != "");
    }
    
    this.input();
  }
  
  this.input = function()
  {
    document.getElementById("gmanager-login-password-textbox").disabled = (document.getElementById("gmanager-login-email-textbox").value == "");
    document.getElementById("gmanager-login-remember-checkbox").disabled = (document.getElementById("gmanager-login-password-textbox").value == "");
  }
  
  this.dialogAccept = function()
  {
    const emailRegExp = /^.+@.+\..+$/;
    const passwordRegExp = /^.+$/;
    
    var errors = new Array();
    var email = document.getElementById("gmanager-login-email-textbox").value;
    var password = document.getElementById("gmanager-login-password-textbox").value;
    
    // Check if the email is valid
    if (!emailRegExp.test(email))
      errors.push(this.getString("valid-email"));
    
    // Check if the password is valid
    if (!passwordRegExp.test(password))
      errors.push(this.getString("valid-password"));
    
    // Check if there were any errors
    if (errors && errors.length > 0)
    {
      // Display the error message
      alert(errors.join("\n"));
    }
    else
    {
      var manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
      var account = (this._account ? this._account : manager.getAccount(email));
      
      // Check if the account does not exist
      if (account === null)
      {
        // Create the account
        account = manager.addAccount("gmail", email, email, null, null);
        
        // Prompt the user to add the account
        if (confirm(this.getString("email-doesnt-exist")))
        {
          // Save the accounts
          manager.save();
        }
        
        // Notify observers that preferences have changed
        var observer = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
        observer.notifyObservers(null, "gmanager-prefs-notify-changed", null);
      }
      
      // Check if the account exists
      if (account !== null)
      {
        // Check if the password should be saved
        if (document.getElementById("gmanager-login-remember-checkbox").checked)
          account.savePassword(password);
        else
          account.removePassword();
        
        // Login to the account (supply the password since it may not be saved)
        account.login(password);
        
        // Close the dialog
        return true;
      }
    }
    
    // Keep the dialog open
    return false;
  }
}