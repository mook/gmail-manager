// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Alerts = new function()
{
  this.NOTIFY_ALERT_CLICKED  = "gmanager-alert-notify-clicked";
  this.NOTIFY_ALERT_FINISHED = "gmanager-alert-notify-finished";
  
  this.ALERT_WINDOW_NAME = "gmanager-alert";
  
  this.display = function(aEmail)
  {
    var manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
    var account = manager.getAccount(aEmail);
    
    if (!this._accounts)
      this._accounts = new Array();
    
    if (account)
    {
      var accountExists = false;
      
      for (var i = 0; i < this._accounts.length && !accountExists; i++)
      {
        if (this._accounts[i].email == account.email)
          accountExists = true;
      }
      
      if (!accountExists)
      {
        this._accounts.push(account);
        
        if (!gmanager_Utils.isWindow(this.ALERT_WINDOW_NAME))
          this._displayNext();
      }
    }
  }
  
  this._displayNext = function()
  {
    if (this._accounts && this._accounts.length > 0)
    {
      var account = this._accounts.shift();
      window.openDialog("chrome://gmanager/content/alert/alert.xul", this.ALERT_WINDOW_NAME, "chrome,dialog=yes,titlebar=no,popup=yes", account, this);
    }
  }
  
  this.observe = function(aSubject, aTopic, aData)
  {
    switch (aTopic)
    {
      case this.NOTIFY_ALERT_CLICKED:
      {
        // aSubject : null
        // aTopic   : gmanager_Alerts.NOTIFY_ALERT_CLICKED
        // aData    : email (e.g. longfocus@gmail.com)
        
        // Load the account inbox
        gmanager_Accounts.loadInbox(aData, "background");
        
        break;
      }
      case this.NOTIFY_ALERT_FINISHED:
      {
        // aSubject : null
        // aTopic   : gmanager_Alerts.NOTIFY_ALERT_FINISHED
        // aData    : email (e.g. longfocus@gmail.com)
        
        // Display the next alert (if available)
        this._displayNext();
        
        break;
      }
      default:
        break;
    }
  }
}