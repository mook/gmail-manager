// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

// Extension version
const EXTENSION_VERSION = "0.6";

// Global account type
const GLOBAL_TYPE = "global";

function gmManager()
{
  // Load the services
  this._logger = Components.classes["@longfocus.com/gmanager/logger;1"].getService(Components.interfaces.gmILogger);
  this._parser = Components.classes["@longfocus.com/gmanager/parser;1"].getService(Components.interfaces.gmIParser);
  
  // Initialize the preferences directory
  var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
  var prefsDir = directoryService.get("ProfD", Components.interfaces.nsIFile);
  prefsDir.append("gmanager");
  
  // Make sure the preferences directory exists
  if (!prefsDir.exists())
    prefsDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
  
  // Initialize the main preferences file
  this._prefsXML = prefsDir.clone();
  this._prefsXML.append("prefs.xml");
  
  // Initialize the backup preferences file
  this._prefsBAK = prefsDir.clone();
  this._prefsBAK.append("prefs.bak");
  
  // Load the preferences
  this.load();
}
gmManager.prototype = {
  _logger: null,
  _parser: null,
  _prefsXML: null,
  _prefsBAK: null,
  _doc: null,
  _accounts: null,
  _accountsRemoved: null,
  
  get version()
  {
    return EXTENSION_VERSION;
  },
  
  get global()
  {
    return this._accounts[GLOBAL_TYPE];
  },
  
  get defaultGlobal()
  {
    return this._createAccount(this._parser.globalNode);
  },
  
  get defaultAccount()
  {
    return this._createAccount(this._parser.accountNode);
  },
  
  load: function()
  {
    // Load the main preferences file
    this._doc = this._parser.open(this._prefsXML);
    
    // Check if the doc exists
    if (!this._doc)
    {
      // Load the backup preferences file
      this._doc = this._parser.open(this._prefsBAK);
      
      // Check if the doc exists
      if (!this._doc)
      {
        this._doc = this._parser.emptyDoc.cloneNode(true);
        this._doc.documentElement.setAttribute("version", EXTENSION_VERSION);
      }
    }
    
    // Load the accounts  
    this._loadAccounts();
  },
  
  _loadAccounts: function()
  {
    var accountsTemp = new Array();
    var accountElements = this._doc.getElementsByTagName("account");
    
    if (!this._accounts)
      this._accounts = new Array();
    
    for (var i = 0; i < accountElements.length; i++)
    {
      var account = this._createAccount(accountElements.item(i));
      var email = this._getEmail(account.node);
      
      if (email in this._accounts)
      {
        this._accounts[email].load(account.node);
        account = this._accounts[email];
        delete this._accounts[email];
      }
      
      accountsTemp[email] = account;
    }
    
    this._accountsRemoved = this._accounts;
    this._accounts = accountsTemp;
  },
  
  _getEmail: function(aNode)
  {
    if (aNode)
      return (aNode.hasAttribute("email") ? aNode.getAttribute("email") : GLOBAL_TYPE);
    return null;
  },
  
  _createAccount: function(aNode)
  {
    // Create the account
    var gmAccount = new Components.Constructor("@longfocus.com/gmanager/account;1", Components.interfaces.gmIAccount, "load");
    return new gmAccount(aNode.cloneNode(true));
  },
  
  save: function()
  {
    // Check if the main preferences file exists
    if (this._prefsXML.exists())
    {
      // Check if the backup preferences file exists
      if (this._prefsBAK.exists())
        this._prefsBAK.remove(false);
      
      // Save the backup preferences file
      this._prefsXML.copyTo(null, this._prefsBAK.leafName);
    }
    
    var accountNodes = this._doc.getElementsByTagName("account");
    
    for (var i = 0; i < accountNodes.length; i++)
    {
      var oldAccountNode = accountNodes.item(i);
      var oldAccountEmail = this._getEmail(oldAccountNode);
      
      if (oldAccountEmail in this._accounts)
      {
        var newAccountNode = this._accounts[oldAccountEmail].node;
        
        if (newAccountNode.hasAttribute("password"))
        {
          var password = newAccountNode.getAttribute("password");
          newAccountNode.removeAttribute("password");
          this._accounts[oldAccountEmail].savePassword(password);
        }
        
        // Replace the account node with the updated one
        this._doc.documentElement.replaceChild(newAccountNode, oldAccountNode);
      }
      else
        this._doc.documentElement.removeChild(oldAccountNode);
    }
    
    // Save the main preferences file
    this._parser.save(this._prefsXML, this._doc);
    
    for (var email in this._accountsRemoved)
      this._accountsRemoved[email].removePassword();
  },
  
  importPrefs: function(aFile)
  {
    var docTemp = this._parser.open(aFile);
    
    if (docTemp)
    {
      this._doc = docTemp;
      
      // Load the accounts  
      this._loadAccounts();
    }
    
    return (docTemp != null);
  },
  
  exportPrefs: function(aFile)
  {
    var docTemp = this._doc.cloneNode(true);
    var accountNodes = docTemp.getElementsByTagName("account");
    
    for (var i = 0; i < accountNodes.length; i++)
    {
      var accountNode = accountNodes.item(i);
      accountNode.removeAttribute("password");
    }
    
    return this._parser.save(aFile, docTemp);
  },
  
  getAccounts: function(aCount)
  {
    var accounts = new Array();
    
    for (var email in this._accounts)
    {
      if (this._accounts[email].type != GLOBAL_TYPE)
        accounts.push(this._accounts[email]);
    }
    
    aCount.value = accounts.length;       
    
    return accounts;
  },
  
  getAccount: function(aEmail)
  {
    if (aEmail in this._accounts)
      return this._accounts[aEmail];
  },
  
  isAccount: function(aEmail)
  {
    return (aEmail in this._accounts);
  },
  
  addAccount: function(aType, aEmail, aAlias, aPassword, aNode)
  {
    // Check if the email account exists
    if (aEmail in this._accounts)
      return null;
    
    // Set the account node
    var node = (aNode ? aNode : this._parser.accountNode.cloneNode(true));
    
    // Set the account details
    node.setAttribute("type", aType);
    node.setAttribute("email", aEmail);
    node.setAttribute("alias", aAlias);
    node.setAttribute("password", aPassword);
    
    // Append the account node
    this._doc.documentElement.appendChild(node);
    
    // Create the account
    this._accounts[aEmail] = this._createAccount(node);
    
    // Check if the email account exists
    if (aEmail in this._accountsRemoved)
    {
      // Remove the account
      delete this._accountsRemoved[aEmail];
    }
    
    // Return the account
    return this._accounts[aEmail];
  },
  
  removeAccount: function(aEmail)
  {
    // Check if the email account exists
    if (aEmail in this._accounts)
    {
      // Add the account to the removed list
      this._accountsRemoved[aEmail] = this._accounts[aEmail];
      
      // Remove the account
      delete this._accounts[aEmail];
    }
  },
  
  QueryInterface: function(iid)
  {
    if (iid.equals(Components.interfaces.gmIManager) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

var myModule = {
  firstTime: true,
  
  myCID: Components.ID("{bf43b6d0-f7dd-11da-974d-0800200c9a66}"),
  myDesc: "Mail Accounts Manager",
  myProgID: "@longfocus.com/gmanager/manager;1",
  myFactory: {
    createInstance: function(outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      
      return (new gmManager()).QueryInterface(iid);
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