// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Accounts = new function()
{
  this.NOTIFY_STATE = "gmanager-accounts-notify-state";

  this.init = function()
  {
    // Load the accounts manager
    this._manager = Components.classes["@longfocus.com/gmanager/manager;1"]
                              .getService(Components.interfaces.gmIManager);
  }

  this.loginAllAccounts = function()
  {
    var accounts = this._manager.getAccounts();

    if (accounts)
    {
      for (var i = 0; i < accounts.length; i++)
      {
        var account = accounts[i];
        if (account && !account.loggedIn)
          account.login(null);
      }
    }
  }

  this.logoutAllAccounts = function()
  {
    var accounts = this._manager.getAccounts();

    if (accounts)
    {
      for (var i = 0; i < accounts.length; i++)
      {
        var account = accounts[i];
        if (account && account.loggedIn)
          account.logout();
      }
    }
  }

  this.checkAllAccounts = function()
  {
    var accounts = this._manager.getAccounts();

    if (accounts)
    {
      for (var i = 0; i < accounts.length; i++)
      {
        var account = accounts[i];
        if (account && account.loggedIn)
          account.check();
      }
    }
  }

  this.loginAccount = function(aEmail)
  {
    var account = this._manager.getAccount(aEmail);

    if (account && !account.loggedIn)
      account.login(null);
  }

  this.logoutAccount = function(aEmail)
  {
    var account = this._manager.getAccount(aEmail);

    if (account && account.loggedIn)
      account.logout();
  }

  this.checkAccount = function(aEmail)
  {
    var account = this._manager.getAccount(aEmail);

    if (account && account.loggedIn)
      account.check();
  }

  this.loadInbox = function(aEmail, aLocation)
  {
    var account = this._manager.getAccount(aEmail);

    if (account)
    {
      account.getInboxAsync(function(aURL, aData) {
        gmanager_Utils.loadURI(aURL, null, aData, aLocation);
      });
    }
  }

  this.loadCompose = function(aEmail, aLocation, aHref)
  {
    var account = this._manager.getAccount(aEmail);

    if (account)
    {
      account.getComposeAsync(function(aURL, aData) {
        gmanager_Utils.loadURI(aURL, null, aData, aLocation);
      }, null, aHref);
    }
    else
      gmanager_Utils.loadDefaultMail(aHref);
  }

  this.init();
}