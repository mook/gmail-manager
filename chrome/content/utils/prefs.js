// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_Prefs = new function()
{
  this.__proto__ = new gmanager_BundlePrefix("gmanager-prefs-");
  
  this.NOTIFY_CHANGED = "gmanager-prefs-notify-changed";
  this.ELEMENT_PREFIX = "gm-prefs-";
  this.BRANCH = "longfocus.gmanager.";
  
  this.init = function()
  {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    this._prefBranch = prefService.getBranch(this.BRANCH);
  }
  
  this.hasPref = function(aName)
  {
    return this._prefBranch.prefHasUserValue(aName);
  }
  
  this.getBoolPref = function(aName)
  {
    return this._prefBranch.getBoolPref(aName);
  }
  
  this.setBoolPref = function(aName, aValue)
  {
    this._prefBranch.setBoolPref(aName, aValue);
  }
  
  this.getCharPref = function(aName)
  {
    return this._prefBranch.getCharPref(aName);
  }
  
  this.setCharPref = function(aName, aValue)
  {
    this._prefBranch.setCharPref(aName, aValue);
  }
  
  this.getIntPref = function(aName)
  {
    return this._prefBranch.getIntPref(aName);
  }
  
  this.setIntPref = function(aName, aValue)
  {
    this._prefBranch.setIntPref(aName, aValue);
  }
  
  this.loadPrefs = function(aNode, aDocument)
  {
    var prefs = aNode.getElementsByTagName("pref");
    
    for (var i = 0; i < prefs.length; i++)
    {
      var pref = prefs.item(i);
      var element = aDocument.getElementById(this.ELEMENT_PREFIX + pref.getAttribute("id"));
      
      if (element)
      {
        var value = pref.getAttribute("value");
        
        switch (element.localName)
        {
          case "checkbox":
            element.checked = (value == "true" ? true : false);
            break;
          case "menupopup":
            element.parentNode.value = value;
            
            if (!element.parentNode.selectedItem)
              element.parentNode.selectedItem = element.firstChild;
            
            break;
          case "radiogroup":
          case "textbox":
            element.value = value;
            break;
          default:
            break;
        }
      }
    }
  }
  
  this.savePrefs = function(aNode, aDocument)
  {
    var prefs = aNode.getElementsByTagName("pref");
    
    for (var i = 0; i < prefs.length; i++)
    {
      var pref = prefs.item(i);
      var element = aDocument.getElementById(this.ELEMENT_PREFIX + pref.getAttribute("id"));
      
      if (element)
      {
        switch (element.localName)
        {
          case "checkbox":
            pref.setAttribute("value", element.checked);
            break;
          case "menupopup":
            pref.setAttribute("value", element.parentNode.value);
            break;
          case "radiogroup":
          case "textbox":
            pref.setAttribute("value", element.value);
            break;
          default:
            break;
        }
      }
    }
  }
  
  this.init();
}