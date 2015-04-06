//
// StoreAScene class
//
var StoreBScene = cc.Class.extend({
  GOODS_NUMBER: 5,
  _mGoodTitles: [],
  _mGoodDescriptions: [],
  _mPrices: [],

  onDidLoadFromCCB: function () {
    applyScaleForNode(this.rootNode);
    fill(this.mBackgroundNode);
    shiftToTop(this.mTopNode);
    shiftToBottom(this.mBottomNode);

    for (var i = 0; i < this.GOODS_NUMBER; i++) {
      try {
        var virtualItem = Soomla.storeInfo.getItemByItemId(this.mGoodTitles[i].getString());
        var purchaseWithMarket = virtualItem.purchasableItem;
        var price = purchaseWithMarket.marketItem.price;

        this.mGoodTitles[i].setString(virtualItem.name);
        this.mGoodDescriptions[i].setString(virtualItem.description);
        this.mPrices[i].setString(price);
      } catch (e) {
        Soomla.logError("StoreBScene: " + Soomla.dumpError(e));
      }
    }

    try {
      var balance = Soomla.storeInventory.getItemBalance("currency_muffin");
    } catch (e) {
      balance = 0;
      Soomla.logError("StoreBScene: " + Soomla.dumpError(e));
    }

    this.updateCurrencyBalance(balance);

    var that = this;

    var superOnEnter = this.rootNode.onEnter;
    this.rootNode.onEnter = function() {
      superOnEnter();
      Soomla.addEventHandler(Soomla.Models.StoreConsts.EVENT_CURRENCY_BALANCE_CHANGED, that.onCurrencyBalanceChanged, that);
    }
    var superOnExit = this.rootNode.onExit;
    this.rootNode.onExit = function() {
      superOnExit();
      Soomla.removeEventHandler(Soomla.Models.StoreConsts.EVENT_CURRENCY_BALANCE_CHANGED, that.onCurrencyBalanceChanged);
    }
  },

  onBack: function (pSender) {
    var scene = cc.BuilderReader.loadAsScene("ccb/StoreAScene");
    cc.Director.getInstance().replaceScene(cc.TransitionMoveInL.create(0.8, scene));
  },

  onBuy: function(pSender) {
    if (pSender) {
      var tag = pSender.getTag();
      cc.log("onBuy: " + tag);
      var itemId = this.itemIdFromTag(tag);
      try {
        Soomla.storeInventory.buyItem(itemId);
      } catch (e) {
        Soomla.logError("StoreBScene: " + Soomla.dumpError(e));
      }
    }
  },

  itemIdFromTag: function (tag) {
    switch (tag) {
      case 0: return "no_ads";
      case 1: return "muffins_10";
      case 2: return "muffins_50";
      case 3: return "muffins_400";
      case 4: return "muffins_1000";
      default: return "ERROR";
    }
  },

  onCurrencyBalanceChanged: function(virtualCurrency, balance, amountAdded) {
    Soomla.logDebug("CurrencyBalanceChanged: " + balance);
    this.updateCurrencyBalance(balance);
  },

  updateCurrencyBalance: function (pBalance) {
    this.mMuffinAmount.setString(pBalance);
  }
});

Object.defineProperty(StoreBScene.prototype, "mGoodTitles", {
  get: function () {
    return this._mGoodTitles;
  },
  set: function (goodTitle) {
    this._mGoodTitles[goodTitle.getTag()] = goodTitle;
  }
});

Object.defineProperty(StoreBScene.prototype, "mGoodDescriptions", {
  get: function () {
    return this._mGoodDescriptions;
  },
  set: function (goodDescription) {
    this._mGoodDescriptions[goodDescription.getTag()] = goodDescription;
  }
});

Object.defineProperty(StoreBScene.prototype, "mPrices", {
  get: function () {
    return this._mPrices;
  },
  set: function (price) {
    this._mPrices[price.getTag()] = price;
  }
});
