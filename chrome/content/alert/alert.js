// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Alert = new function()
{
  this.__proto__ = new gmanager_BundlePrefix("gmanager-alert-");
  
  this.NOTIFY_ALERT_CLICKED  = "gmanager-alert-notify-clicked";
  this.NOTIFY_ALERT_FINISHED = "gmanager-alert-notify-finished";
  
  this.OPEN_STAGE  = 10;
  this.CLOSE_STAGE = 20;
  this.SLIDE_STAGE = 30;
  
  this.FINAL_HEIGHT    = 100;
  this.SLIDE_INCREMENT = 1;
  this.SLIDE_TIME      = 10;
  this.SWITCH_TIME     = 2000;
  this.OPEN_TIME       = 2000;
  
  this.isPlay = true;
  
  this.load = function()
  {
    // Load the services
    this._logger = Components.classes["@longfocus.com/gmanager/logger;1"].getService(Components.interfaces.gmILogger);
    this._timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    
    // Unwrap the window arguments
    if ("arguments" in window)
    {
      // window.arguments[0] : mail account
      // window.arguments[1] : callback listener
      
      this._account = window.arguments[0];
      this._callback = window.arguments[1];
    }
    
    // Check if the account is specified
    if (this._account == null)
    {
      // Close the window
      window.close();
    }
    else
    {
      // Set the account icon
      var accountImage = document.getElementById("gmanager-alert-account-image");
      accountImage.setAttribute("icontype", this._account.type);
      accountImage.setAttribute("status", gmanager_Utils.toStyleStatus(this._account.status));
      
      // Set the account alias
      var accountLabel = document.getElementById("gmanager-alert-account-label");
      accountLabel.setAttribute("value", this._account.alias);
      accountLabel.setAttribute("tooltiptext", this._account.alias);
      
      // Get the account snippets
      this._snippets = this._account.getSnippets({});
      
      // Check if the account is logged in
      if (this._account.loggedIn)
      {
        // Check if the account has any snippets
        if (this._snippets === null || this._snippets.length === 0)
        {
          // Close the window
          window.close();
        }
        
        // Populate the first snippet
        this.firstSnippet();
      }
      else
      {
        document.getElementById("gmanager-alert-navigation-hbox").collapsed = true;
        document.getElementById("gmanager-alert-details-grid").collapsed = true;
        document.getElementById("gmanager-alert-description").setAttribute("clickable", false);
        document.getElementById("gmanager-alert-description").firstChild.nodeValue = this.getString("login");
      }
      
      try {
        var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
        var prefBranch = prefService.getBranch("alerts.");
        
        this.SLIDE_INCREMENT = prefBranch.getIntPref("slideIncrement");
        this.SLIDE_TIME = prefBranch.getIntPref("slideIncrementTime");
        this.OPEN_TIME = prefBranch.getIntPref("totalOpenTime");
      } catch(e) {
        this._logger.log("Error getting the \"alerts\" preferences: " + e);
      }
      
      sizeToContent();
      
      this.FINAL_HEIGHT = window.outerHeight;
      
      window.outerHeight = 1;
      window.moveTo((screen.availLeft + screen.availWidth - window.outerWidth) - 10, screen.availTop + screen.availHeight - window.outerHeight);
      
      this._startTimer(this.OPEN_STAGE, this.SLIDE_TIME);
    }
  }
  
  this.play = function(aEvent)
  {
    gmanager_Alert.isPlay = true;
  }
  
  this.pause = function(aEvent)
  {
    gmanager_Alert.isPlay = false;
  }
  
  this._startTimer = function(aStage, aInterval)
  {
    this._stage = aStage;
    this._timer.initWithCallback(this, aInterval, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
  }
  
  this.notify = function(aTimer)
  {
    switch (this._stage)
    {
      case this.OPEN_STAGE:
      {
        if (window.outerHeight < this.FINAL_HEIGHT)
        {
          window.screenY -= this.SLIDE_INCREMENT;
          window.outerHeight += this.SLIDE_INCREMENT;
        }
        else
          this._startTimer(this.SLIDE_STAGE, this.OPEN_TIME);
        
        break;
      }
      case this.SLIDE_STAGE:
      {
        if (this.isPlay)
        {
          if (this._hasNext())
            this.nextSnippet();
          else
            this._startTimer(this.CLOSE_STAGE, this.SLIDE_TIME);
        }
        
        break;
      }
      case this.CLOSE_STAGE:
      {
        if (window.outerHeight > 1)
        {
          window.screenY += this.SLIDE_INCREMENT;
          window.outerHeight -= this.SLIDE_INCREMENT;
        }
        else
          this.close();
        
        break;
      }
      default:
      {
        this._logger.log("Unknown stage...definitely should not be here!");
        break;
      }
    }
  }
  
  this._populateSnippet = function(aIndex)
  {
    var snippet = this._snippets[aIndex];
    
    // Set the snippet index
    this._snippetIndex = aIndex;
    
    document.getElementById("gmanager-alert-count-label").value = this.getFString("count", [this._snippetIndex + 1, this._snippets.length]);
    document.getElementById("gmanager-alert-from-label").value = gmanager_Utils.toUnicode(snippet.from);
    document.getElementById("gmanager-alert-date-label").value = gmanager_Utils.toUnicode(snippet.date);
    document.getElementById("gmanager-alert-subject-label").value = gmanager_Utils.toUnicode(snippet.subject);
    document.getElementById("gmanager-alert-description").firstChild.nodeValue = gmanager_Utils.toUnicode(snippet.msg);
  }
  
  this.nextSnippet = function()
  {
    if (this._hasNext())
      this._populateSnippet(this._snippetIndex + 1);
  }
  
  this.previousSnippet = function()
  {
    if (this._hasPrevious())
      this._populateSnippet(this._snippetIndex - 1);
  }
  
  this.firstSnippet = function()
  {
    this._populateSnippet(0);
  }
  
  this.lastSnippet = function()
  {
    this._populateSnippet(this._snippets.length - 1);
  }
  
  this._hasNext = function()
  {
    return (this._snippetIndex < this._snippets.length - 1);
  }
  
  this._hasPrevious = function()
  {
    return (this._snippetIndex > 0);
  }
  
  this._notifyObserver = function(aTopic, aData)
  {
    // Check if the callback listener is specified
    if (this._callback != null && typeof this._callback.observe == "function")
    {
      try {
        // Notify the observer about the alert
        this._callback.observe(null, aTopic, aData);
      } catch(e) {
        this._logger.log("Error notifying the observer: " + e);
      }
    }
  }
  
  this.click = function()
  {
    // Notify the observer that the alert was clicked
    this._notifyObserver(this.NOTIFY_ALERT_CLICKED, this._account.email);
    
    // Close the alert
    this.close();
  }
  
  this.close = function()
  {
    // Stop the timer
    this._timer.cancel();
    
    // Close the window
    window.close();
    
    // Notify the observer that the alert has finished
    this._notifyObserver(this.NOTIFY_ALERT_FINISHED, this._account.email);
  }
}