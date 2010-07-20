// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

function gmLogger()
{
  // Load the console service
  this._console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
  
  // Load the preference branch observer
  var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
  this._branch = prefService.getBranch("longfocus.gmanager.").QueryInterface(Components.interfaces.nsIPrefBranchInternal);
  this._branch.addObserver("", this, false);
  
  // Get the current debug preference value (silent)
  this._debug = this._branch.getBoolPref("debug");
}
gmLogger.prototype = {
  _console: null,
  _branch: null,
  _debug: false,
  
  log: function(aMsg)
  {
    // Check if debug is enabled
    if (this._debug)
    {
      // Log the message to the console
      this._console.logStringMessage("gmanager: " + aMsg);
    }
  },
  
  _toggle: function()
  {
    // Get the current debug preference value
    this._debug = this._branch.getBoolPref("debug");
    
    // Display the logging status
    this._console.logStringMessage("gmanager: " + "Logging has been " + (this._debug ? "enabled" : "disabled"));
  },
  
  observe: function(aSubject, aTopic, aData)
  {
    if (aTopic == "nsPref:changed")
    {
      switch (aData)
      {
        case "debug":
          // Toggle the logging status
          this._toggle();
          break;
      }
    }
  },
  
  QueryInterface: function(iid)
  {
    if (iid.equals(Components.interfaces.gmILogger) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

var myModule = {
  firstTime: true,
  
  myCID: Components.ID("{07d9b512-8e83-418a-a540-0ec804b82195}"),
  myDesc: "Debug Logger Service",
  myProgID: "@longfocus.com/gmanager/logger;1",
  myFactory: {
    createInstance: function(outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      
      return (new gmLogger()).QueryInterface(iid);
    }
  },
  
  registerSelf: function(compMgr, fileSpec, location, type)
  {
    if (this.firstTime) {
      this.firstTime = false;
      throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
    }
    
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(this.myCID, this.myDesc, this.myProgID, fileSpec, location, type);
  },
  
  getClassObject: function(compMgr, cid, iid)
  {
    if (!cid.equals(this.myCID))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    
    if (!iid.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    
    return this.myFactory;
  },
  
  canUnload: function(compMgr) { return true; }
};

function NSGetModule(compMgr, fileSpec) { return myModule; }