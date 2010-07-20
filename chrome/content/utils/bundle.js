// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Bundle = new function()
{
  this.PROPERTIES = "chrome://gmanager/locale/gmanager.properties";
  
  this.init = function()
  {
    var bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
    if (bundleService)
      this._bundle = bundleService.createBundle(this.PROPERTIES);
  }
  
  this.getString = function(aName)
  {
    var value = aName;
    try {
      value = this._bundle.GetStringFromName(aName);
    } catch (e) {}
    return value;
  }
  
  this.getFString = function(aName, aParams)
  {
    var value = aName;
    try {
      value = this._bundle.formatStringFromName(aName, aParams, aParams.length);
    } catch (e) {}
    return value;
  }
  
  this.init();
}

var gmanager_BundlePrefix = function(aPrefix)
{
  this.PREFIX = aPrefix;
  
  this.getString = function(aKey)
  {
    return gmanager_Bundle.getString(this.PREFIX + aKey);
  }
  
  this.getFString = function(aKey, aParams)
  {
    return gmanager_Bundle.getFString(this.PREFIX + aKey, aParams);
  }
}