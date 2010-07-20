// Gmail Manager
// By Todd Long <longfocus@gmail.com>
// http://www.longfocus.com/firefox/gmanager/

var gmanager_ToolbarMove = new function()
{
  this.TOOLBAR_FLAVOUR = "text/gmanager-toolbar-panel";
  this.DRAGDROP_ACTION = Components.interfaces.nsIDragService.DRAGDROP_ACTION_MOVE;
  
  this.isActive = function()
  {
    return this._isActive;
  }
  
  this.initDrag = function(aEvent)
  {
    this._toolbars = gmanager_Utils.getToolbars();
    this._dragOverItem = null;
    
    if (this._toolbars.length > 0)
    {
      var splitter = document.getElementById("urlbar-search-splitter");
      if (splitter)
        splitter.parentNode.removeChild(splitter);
      
      this._isActive = true;
      this._toggleMenuBar(true);
      this._addToolbarListeners();
      this._wrapToolbarItems();
      
      nsDragAndDrop.startDrag(aEvent, gmanager_ToolbarMove);
      
      // TODO: Fix the drag-and-drop service invocation
      
      // Borrowed from nsDragAndDrop.js prior to 3.5.*
      try {
        // Use the drag service already available
        var dragService = nsDragAndDrop.mDragService;
        var dataTransfer = aEvent.dataTransfer;
        var transArray = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
        
        // Setup the transfer data
        var data = dataTransfer.getData(this.TOOLBAR_FLAVOUR);
        var transferData = new TransferData();
        transferData.addDataForFlavour(this.TOOLBAR_FLAVOUR, data);
        
        // Since we are only moving one item
        var trans = nsTransferable.set(transferData);
        transArray.AppendElement(trans.QueryInterface(Components.interfaces.nsISupports));
        
        // Invoke the modal drag session using an image
        dragService.invokeDragSessionWithImage(aEvent.target, transArray,
                                               null, this.DRAGDROP_ACTION,
                                               null, 0, 0, aEvent, dataTransfer);
      } catch(e) {
        // this could be because the user pressed escape to
        // cancel the drag. even if it's not, there's not much
        // we can do, so be silent.
      }
      
      this._isActive = false;
      this._toggleMenuBar(false);
      this._removeToolbarListeners();
      this._unwrapToolbarItems();
      
      if (typeof UpdateUrlbarSearchSplitterState == "function")
        UpdateUrlbarSearchSplitterState();
    }
  }
  
  this._toggleMenuBar = function(aBool)
  {
    var menubar = document.getElementById("main-menubar");
    if (menubar)
    {
      for (var i = 0; i < menubar.childNodes.length; ++i)
        menubar.childNodes[i].setAttribute("disabled", aBool);
    }
  }
  
  this._addToolbarListeners = function()
  {
    for (var i = 0; i < this._toolbars.length; i++)
    {
      this._toolbars[i].addEventListener("dragover", this._onToolbarDragOver, false);
      this._toolbars[i].addEventListener("dragdrop", this._onToolbarDragDrop, false);
      this._toolbars[i].addEventListener("dragexit", this._onToolbarDragExit, false);
    }
  }
  
  this._removeToolbarListeners = function()
  {
    for (var i = 0; i < this._toolbars.length; i++)
    {
      this._toolbars[i].removeEventListener("dragover", this._onToolbarDragOver, false);
      this._toolbars[i].removeEventListener("dragdrop", this._onToolbarDragDrop, false);
      this._toolbars[i].removeEventListener("dragexit", this._onToolbarDragExit, false);
    }
  }
  
  this._isCustomizableToolbar = function(aToolbar)
  {
    if (aToolbar)
      return (aToolbar.localName == "toolbar" || aToolbar.localName == "statusbar");
    return false;
  }
  
  this._isToolbarItem = function(aItem)
  {
    if (aItem)
      return aItem.localName == "toolbarbutton" ||
             aItem.localName == "toolbaritem" ||
             aItem.localName == "toolbarseparator" ||
             aItem.localName == "toolbarspacer" ||
             aItem.localName == "toolbarspring" ||
             aItem.localName == "statusbarpanel";
    return false;
  }
  
  this._wrapToolbarItem = function(aItem)
  {
    var wrapper = this._createWrapper(aItem.id);
    
    wrapper.flex = aItem.flex;
    
    if (aItem.parentNode)
      aItem.parentNode.removeChild(aItem);
    
    wrapper.appendChild(aItem);
    
    return wrapper;
  }
  
  this._createWrapper = function(aId)
  {
    var wrapper = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "toolbarpaletteitem");
    wrapper.id = "wrapper-" + aId;  
    return wrapper;
  }
  
  this._cleanupItemForToolbar = function(aItem, aWrapper)
  {
    this._setWrapperType(aItem, aWrapper);
    aWrapper.setAttribute("place", "toolbar");
    
    if (aItem.hasAttribute("command"))
    {
      aWrapper.setAttribute("itemcommand", aItem.getAttribute("command"));
      aItem.removeAttribute("command");
    }
    
    // Check if the item is disabled
    if (aItem.disabled)
    {
      aWrapper.setAttribute("itemdisabled", "true");
      aItem.setAttribute("disabled", "false");
    }
    
    // TODO: Show collapsed and disabled elements
    
//    // Check if the item is collapsed
//    if (aItem.collapsed)
//    {
//      aWrapper.setAttribute("itemcollapsed", "true");
//      aItem.setAttribute("collapsed", "false");
//    }
//    
//    // Check if the item is hidden
//    if (aItem.hidden)
//    {
//      aWrapper.setAttribute("itemhidden", "true");
//      aItem.setAttribute("hidden", "false");
//    }
  }
  
  this._setWrapperType = function(aItem, aWrapper)
  {
    if (aItem.localName == "toolbarseparator")
      aWrapper.setAttribute("type", "separator");
    else if (aItem.localName == "toolbarspring")
      aWrapper.setAttribute("type", "spring");
    else if (aItem.localName == "toolbarspacer")
      aWrapper.setAttribute("type", "spacer");
    else if (aItem.localName == "toolbaritem" && aItem.firstChild)
      aWrapper.setAttribute("type", aItem.firstChild.localName);
  }
  
  this._wrapToolbarItems = function()
  {
    for (var i = 0; i < this._toolbars.length; i++)
    {
      var toolbar = this._toolbars[i];
      
      if (this._isCustomizableToolbar(toolbar))
      {
        for (var k = 0; k < toolbar.childNodes.length; k++)
        {
          var item = toolbar.childNodes[k];
          
          if (this._isToolbarItem(item))
          {
            var nextSibling = item.nextSibling;
            var wrapper = this._wrapToolbarItem(item);
            
            if (nextSibling)
              toolbar.insertBefore(wrapper, nextSibling);
            else
              toolbar.appendChild(wrapper);
            
            this._cleanupItemForToolbar(item, wrapper);
          }
        }
      }
    }
  }
  
  this._unwrapToolbarItems = function()
  {
    for (var i = 0; i < this._toolbars.length; i++)
    {
      var paletteItems = this._toolbars[i].getElementsByTagName("toolbarpaletteitem");
      
      while (paletteItems.length > 0)
      {
        var paletteItem = paletteItems.item(0);
        var toolbarItem = paletteItem.firstChild;
        
        for (var k = 0; k < paletteItem.attributes.length; k++)
        {
          var attributeName = paletteItem.attributes.item(k).nodeName;
          var nameMatch = attributeName.match("^item(.+)$");
          
          if (nameMatch != null)
            toolbarItem.setAttribute(nameMatch[1], paletteItem.getAttribute(attributeName));
        }
        
        paletteItem.parentNode.replaceChild(toolbarItem, paletteItem);
      }
    }
  }
  
  this._onToolbarDragOver = function(aEvent)
  {
    nsDragAndDrop.dragOver(aEvent, gmanager_ToolbarMove);
  }
  
  this._onToolbarDragDrop = function(aEvent)
  {
    nsDragAndDrop.drop(aEvent, gmanager_ToolbarMove);
  }
  
  this._onToolbarDragExit = function(aEvent)
  {
    if (this._dragOverItem)
      this._setDragActive(this._dragOverItem, false);
  }
  
  this._setDragActive = function(aItem, aBool)
  {
    var node = aItem;
    
    if (aItem && this._isCustomizableToolbar(aItem.localName))
      node = aItem.lastChild;
    
    if (node)
    {
      if (aBool)
      {
        var direction = window.getComputedStyle(aItem, null).direction;
        var value = (direction == "ltr" ? "left" : "right");
        
        node.setAttribute("dragover", value);
      }
      else
        node.removeAttribute("dragover");
    }
  }
  
  this.onDragStart = function(aEvent, aXferData, aDragAction)
  {
    var item = aEvent.target;
    while (item && item.localName != "toolbarpaletteitem")
      item = item.parentNode;
    
    item.setAttribute("dragactive", "true");
    
    aXferData.data = new TransferData();
    aXferData.data.addDataForFlavour(this.TOOLBAR_FLAVOUR, item.firstChild.id);
    
    aDragAction.action = this.DRAGDROP_ACTION;
  }
  
  this.onDragOver = function(aEvent, aFlavour, aDragSession)
  {
    var toolbar = aEvent.target;
    var dropTarget = aEvent.target;
    
    while (!this._isCustomizableToolbar(toolbar))
    {
      dropTarget = toolbar;
      toolbar = toolbar.parentNode;
    }
    
    var previousDragItem = this._dragOverItem;
    
    if (this._isCustomizableToolbar(dropTarget))
      this._dragOverItem = dropTarget;
    else
    {
      var direction = window.getComputedStyle(dropTarget.parentNode, null).direction;
      var dropTargetCenter = (dropTarget.boxObject.x + (dropTarget.boxObject.width / 2));
      var dragAfter = (direction == "ltr" ? aEvent.clientX > dropTargetCenter : aEvent.clientX < dropTargetCenter);
      
      if (dragAfter)
        this._dragOverItem = (dropTarget.nextSibling ? dropTarget.nextSibling : toolbar);
      else
        this._dragOverItem = dropTarget;
    }
    
    if (previousDragItem && previousDragItem != this._dragOverItem)
      this._setDragActive(previousDragItem, false);
    
    this._setDragActive(this._dragOverItem, true);
    
    aDragSession.canDrop = true;
  }
  
  this.onDrop = function(aEvent, aXferData, aDragSession)
  {
    if (!this._dragOverItem)
      return;
    
    this._setDragActive(this._dragOverItem, false);
    
    var draggedItemId = aXferData.data;
    if (draggedItemId == this._dragOverItem.id)
      return;
    
    var toolbar = aEvent.target;
    while (!this._isCustomizableToolbar(toolbar))
      toolbar = toolbar.parentNode;
    
    var wrapper = document.getElementById("wrapper-" + draggedItemId);
    if (wrapper == this._dragOverItem)
      return;
    
    // Remove the item from its current toolbar
    wrapper.parentNode.removeChild(wrapper);
    
    // Insert the item in the new toolbar
    if (toolbar != this._dragOverItem)
      toolbar.insertBefore(wrapper, this._dragOverItem);
    else
      toolbar.appendChild(wrapper);
    
    var toolbarPanel = wrapper.firstChild;
    if (gmanager_Utils.isAccountToolbar(toolbarPanel))
    {
      var account = toolbarPanel.account;
      if (account)
      {
        var specificPosition = -1;
        var toolbarChildren = toolbar.childNodes;
        for (var i = 0; i < toolbarChildren.length; i++)
        {
          var toolbarNode = toolbarChildren.item(i);
          if (wrapper.id == toolbarNode.id)
            specificPosition = i;
        }
        
        account.setCharPref("toolbar-toolbar-id", toolbar.id);
        account.setCharPref("toolbar-placement", "specific-position");
        account.setIntPref("toolbar-specific-position", specificPosition);
        
        var manager = Components.classes["@longfocus.com/gmanager/manager;1"].getService(Components.interfaces.gmIManager);
        manager.save();
      }
    }
  }
  
  this.getSupportedFlavours = function()
  {
    var flavours = new FlavourSet();
    flavours.appendFlavour(this.TOOLBAR_FLAVOUR);
    return flavours;
  }
}