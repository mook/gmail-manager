// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_ToolbarTooltip = new function()
{
  this.__proto__ = new gmanager_BundlePrefix("gmanager-toolbar-tooltip-");
  
  this.buildTooltip = function(aTooltip)
  {
    var manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
    var account = aTooltip.parentNode.displayAccount;
    
    // Clear the menu
    gmanager_Utils.clearKids(aTooltip);
    
    // Check if the account exists
    if (account != undefined)
    {
      // Account Header
      aTooltip.appendChild(this._buildAccountHeader(account));
      
      // Check if the account is logged in
      if (account.loggedIn)
      {
        // Account Details
        aTooltip.appendChild(this._buildAccountDetails(account));
      }
    }
    else
    {
      // Account Status
      aTooltip.appendChild(this._buildMessage(account));
    }
    
    return !gmanager_ToolbarMove.isActive();
  }
  
  this._buildAccountHeader = function(aAccount)
  {
    var elParent = document.createElement("hbox");
    elParent.setAttribute("style", "font-size:12px; margin-bottom:4px;");
    
    // Status Icon
    var el = document.createElement("image");
    el.setAttribute("class", "gmanager-icon");
    el.setAttribute("iconsize", "small");
    el.setAttribute("icontype", aAccount.type);
    el.setAttribute("status", gmanager_Utils.toStyleStatus(aAccount.status));
    el.setAttribute("newMail", (aAccount.unread > 0 ? "true" : "false"));
    elParent.appendChild(el);
    
    // Account Email
    el = document.createElement("label");
    el.setAttribute("class", "gmanager-bold");
    el.setAttribute("value", gmanager_Utils.toUnicode(aAccount.alias));
    elParent.appendChild(el);
    
    var bundleKey = null;
    
    if (aAccount.status == Components.interfaces.gmIService.STATE_CONNECTING)
      bundleKey = (aAccount.loggedIn ? "checking-mail" : "logging-in");
    else
      bundleKey = (aAccount.loggedIn ? "logged-in" : "logged-out");
    
    // Account Status
    el = document.createElement("label");
    el.setAttribute("value", this.getString(bundleKey));
    elParent.appendChild(el);
    
    return elParent;
  }
  
  this._buildAccountDetails = function(aAccount)
  {
    var elParent = document.createElement("vbox");
    elParent.setAttribute("style", "font-size:11px; margin-left:6px;");
    
    // Inbox Unread
    var el = document.createElement("label");
    el.setAttribute("flex", "1");
    el.setAttribute("value", this.getFString("inbox-unread", [aAccount.inboxUnread]));
    elParent.appendChild(el);
    
    // Saved Drafts
    el = document.createElement("label");
    el.setAttribute("value", this.getFString("saved-drafts", [aAccount.savedDrafts]));
    el.setAttribute("hidden", (aAccount.savedDrafts == 0));
    elParent.appendChild(el);
    
    // Spam Unread
    el = document.createElement("label");
    el.setAttribute("value", this.getFString("spam-unread", [aAccount.spamUnread]));
    el.setAttribute("hidden", (aAccount.spamUnread == 0));
    elParent.appendChild(el);
    
    if (true) // TODO: Add preference to show/hide labels
    {
      var elHbox = document.createElement("hbox");
      var elGrid = document.createElement("grid");
      var elRows = document.createElement("rows");
      var labels = aAccount.getLabels({});
      
      elGrid.setAttribute("style", "margin:6px 4px;");
      
      for (var i = 0; i < labels.length; i++)
      {
        var isUnread = (labels[i].unread > 0);
        var elRow = document.createElement("row");
        elRow.setAttribute("align", "center");
        elRow.setAttribute("class", (isUnread ? "gmanager-bold" : ""));
        
        // Label Name
        el = document.createElement("label");
        el.setAttribute("value", gmanager_Utils.toUnicode(labels[i].name));
        elRow.appendChild(el);
        
        // Label Unread
        el = document.createElement("label");
        el.setAttribute("value", labels[i].unread);
        el.setAttribute("style", "margin-left:4px");
        elRow.appendChild(el);
        
        if (isUnread || !aAccount.getBoolPref("toolbar-tooltip-show-labels")) // TODO: Add preference to show/hide labels with unread mail
          elRows.appendChild(elRow);
      }
      
      if (elRows.hasChildNodes())
      {
        elGrid.appendChild(elRows);
        elHbox.appendChild(elGrid);
        elParent.appendChild(elHbox);
      }
    }
    
    // Space Used
    el = document.createElement("label");
    el.setAttribute("value", this.getFString("space-used", [aAccount.spaceUsed, aAccount.percentUsed, aAccount.totalSpace]));
    elParent.appendChild(el);
    
    if (aAccount.getBoolPref("toolbar-tooltip-show-snippets"))
    {
      // Snippets
      var snippets = aAccount.getSnippets({});
      
      if (snippets.length > 0)
      {
        // Separator
        el = document.createElement("separator");
        el.setAttribute("class", "groove");
        el.setAttribute("style", "margin:6px 0 0 0;");
        elParent.appendChild(el);
        
        for (var i = 0; i < Math.min(10, snippets.length); i++)
        {
          var elHbox = document.createElement("hbox");
          elHbox.setAttribute("flex", "1");
          elHbox.setAttribute("style", "margin-top:8px");
          
          el = document.createElement("label");
          el.setAttribute("crop", "end");
          el.setAttribute("flex", "1");
          el.setAttribute("class", "gmanager-bold");
          el.setAttribute("style", "font-size:10px;");
          el.setAttribute("value", gmanager_Utils.toUnicode(snippets[i].from) + " > " + gmanager_Utils.toUnicode(snippets[i].subject));
          elHbox.appendChild(el);
          
          el = document.createElement("label");
          el.setAttribute("class", "gmanager-bold");
          el.setAttribute("value", gmanager_Utils.toUnicode(snippets[i].time));
          elHbox.appendChild(el);
          elParent.appendChild(elHbox);
          
          el = document.createElement("description");
          el.setAttribute("crop", "end");
          el.setAttribute("style", "font-size:9px; margin:2px 0 0 0;");
          el.setAttribute("value", gmanager_Utils.toUnicode(snippets[i].msg));
          elParent.appendChild(el);
        }
        
        el = document.createElement("separator");
        el.setAttribute("class", "thin");
        elParent.appendChild(el);
      }
    }
    
    return elParent;
  }
  
  this._buildMessage = function(aAccount)
  {
    var bundleKey = "msg-logged-out";
    
    if (aAccount != undefined)
    {
      switch (aAccount.status)
      {
        case Components.interfaces.gmIService.STATE_CONNECTING:
          bundleKey = "msg-connecting";
          break;
        case Components.interfaces.gmIService.STATE_ERROR_PASSWORD:
          bundleKey = "msg-error-password";
          break;
        case Components.interfaces.gmIService.STATE_ERROR_NETWORK:
          bundleKey = "msg-error-network";
          break;
        case Components.interfaces.gmIService.STATE_ERROR_TIMEOUT:
          bundleKey = "msg-error-timeout";
          break;
      }
    }
    
    var elParent = document.createElement("vbox");
    elParent.setAttribute("style", "font-size:12px; margin-left:3px;");
    
    var bundleString = this.getString(bundleKey).split("|");
    for (var i = 0; i < bundleString.length; i++)
    {
      var el = document.createElement("label");
      el.setAttribute("value", bundleString[i]);
      elParent.appendChild(el);
    }
    
    return elParent;
  }
}