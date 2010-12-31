// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_ToolbarClick = new function()
{
  this.click = function(aEvent)
  {
    var toolbarPanel = aEvent.target;
    
    if (aEvent.button !== 2)
    {
      var account = toolbarPanel.displayAccount;
      
      if (account != null)
      {
        var manager = Components.classes["@longfocus.com/gmanager/manager;1"]
                                .getService(Components.interfaces.gmIManager);
        var action = null;
        
        switch (aEvent.button)
        {
          case 0: // Left Click
            action = manager.global.getCharPref("toolbar-left-click");
            break;
          case 1: // Middle Click
            action = manager.global.getCharPref("toolbar-middle-click");
            break;
          default:
            break;
        }
        
        switch (action)
        {
          case "check-messages":
            account.loggedIn ? account.check() : account.login(null);
            break;
          case "compose-message":
            action = manager.global.getCharPref("compose-tab-location");
            gmanager_Accounts.loadCompose(account.email, action, null);
            break;
          case "blank":
          case "current":
          case "existing":
          case "focused":
          case "background":
          case "window":
          {
            // Check if the account is logged in
            if (account.loggedIn)
            {
              // Check if the unread count should be reset
              if (manager.global.getBoolPref("toolbar-reset-unread-count"))
                account.resetUnread();
              
              gmanager_Accounts.loadInbox(account.email, action);
            }
            else
              account.login(null);
            
            break;
          }
          default:
            break;
        }
      }
      else
        window.openDialog("chrome://gmanager/content/login/login.xul",
                          "login",
                          "centerscreen,chrome,modal");
    }
    
    return true;
  }
}