var PrevSoomla = Soomla;
Soomla = new function () {

  var platform = {
    name: sys.os.toLowerCase(),
    isNativeSupported: function isNativeSupported() {
      return this.isAndroid() || this.isIos();
    },
    isAndroid: function isAndroid() {
      return this.name === "android";
    },
    isIos: function isIos() {
      return this.name === "ios";
    }
  };

  var Soomla = _.extend(PrevSoomla, {Models: {}}); // merge with binding instance

  Soomla.DEBUG = false;

  var declareClass = Soomla.declareClass = function (ClassName, fields, parentClass) {
    // TODO: It's better if change it to standard constructor
    var Clazz = function () {
      var obj = _.extend(parentClass ? parentClass() : {}, fields ? fields : {}, {
        className: ClassName
      });

      if (_.isFunction(obj.ctor)) {
        obj.ctor.call(obj);
      }
      return obj;
    };
    Clazz.create = function (values) {
      var instance = _.defaults(values ? _.omit(values, "className") : {}, Clazz());
      // TODO: Do not think it works
      if (typeof instance.onCreate == 'function') {
        instance.onCreate();
      }
      return instance;
    };

    return Clazz;
  };

  //------ Core ------//
  /**
   * Domain
   */
  var Domain = Soomla.Models.Domain = declareClass("Domain", {
  });

  /**
   * SoomlaEntity
   */
  var SoomlaEntity = Soomla.Models.SoomlaEntity = declareClass("SoomlaEntity", {
    name: "",
    description: "",
    itemId: null,
    equals: function equals(obj) {
      // If parameter is null return false.
      if (obj == null) {
        return false;
      }

      if (obj.className != this.className) {
        return false;
      }

      if (obj.itemId != this.itemId) {
        return false;
      }

      return true;
    }
  }, Domain);


  /**
   * Recurrence
   */
  var Recurrence = Soomla.Models.Recurrence = {
    EVERY_MONTH: 0,
    EVERY_WEEK: 1,
    EVERY_DAY: 2,
    EVERY_HOUR: 3,
    NONE: 4
  };

  /**
   * DateTimeRange
   */
  var DateTimeRange = Soomla.Models.DateTimeRange = declareClass("DateTimeRange", {
    schedTimeRangeStart: null,
    schedTimeRangeEnd: null
  });

  /**
   * Schedule
   */
  var Schedule = Soomla.Models.Schedule = declareClass("Schedule", {
    schedRecurrence: null,
    schedTimeRanges: null,
    schedApprovals: null,
    approve: function approve(activationTimes) {
      var now = Date.now();

      if (this.schedApprovals && this.schedApprovals < 1 && (!this.schedTimeRanges || this.schedTimeRanges.length == 0)) {
        logDebug("There's no activation limit and no TimeRanges. APPROVED!");
        return true;
      }

      if (this.schedApprovals && this.schedApprovals > 0 && activationTimes >= this.schedApprovals) {
        logDebug("Activation limit exceeded.");
        return false;
      }

      if ((!this.schedTimeRanges || this.schedTimeRanges.length == 0)) {
        logDebug("We have an activation limit that was not reached. Also, we don't have any time ranges. APPROVED!");
        return true;
      }


      // NOTE: From this point on ... we know that we didn't reach the activation limit AND we have TimeRanges.
      //		 We'll just make sure the time ranges and the Recurrence copmlies.

      var found = _.find(this.schedTimeRanges, function(dateTimeRange) {
        if (now < dateTimeRange.schedTimeRangeStart && now > dateTimeRange.schedTimeRangeEnd) {
          logDebug("We are just in one of the time spans, it can't get any better then that. APPROVED!");
          return true;
        }
      });

      if (found) {
        return true;
      }

      // we don't need to continue if RequiredRecurrence is NONE
      if (this.schedRecurrence == Recurrence.NONE) {
        return false;
      }

      var _this = this;
      return _.find(this.schedTimeRanges, function(dateTimeRange) {
          if (now.getMinutes() >= dateTimeRange.schedTimeRangeStart.getMinutes()
            && now.getMinutes() <= dateTimeRange.schedTimeRangeEnd.getMinutes()) {

            logDebug("Now is in one of the time ranges' minutes span.");

            if (_this.schedRecurrence == Recurrence.EVERY_HOUR) {
              logDebug(TAG, "It's a EVERY_HOUR recurrence. APPROVED!");
              return true;
            }

            if (now.getHours() >= dateTimeRange.schedTimeRangeStart.getHours()
              && now.getHours() <= dateTimeRange.schedTimeRangeEnd.getHours()) {

              logDebug("Now is in one of the time ranges' hours span.");

              if (_this.schedRecurrence == Recurrence.EVERY_DAY) {
                logDebug("It's a EVERY_DAY recurrence. APPROVED!");
                return true;
              }

              if (now.getDay() >= dateTimeRange.schedTimeRangeStart.getDay()
                && now.getDay() <= dateTimeRange.schedTimeRangeEnd.getDay()) {

                logDebug("Now is in one of the time ranges' day-of-week span.");

                if (_this.schedRecurrence == Recurrence.EVERY_WEEK) {
                  logDebug("It's a EVERY_WEEK recurrence. APPROVED!");
                  return true;
                }

                if (now.getDate() >= dateTimeRange.schedTimeRangeStart.getDate()
                  && now.getDate() <= dateTimeRange.schedTimeRangeEnd.getDate()) {

                  logDebug("Now is in one of the time ranges' days span.");

                  if (_this.schedRecurrence == Recurrence.EVERY_MONTH) {
                    logDebug("It's a EVERY_MONTH recurrence. APPROVED!");
                    return true;
                  }
                }
              }
            }
          }
        }) || false;
    }
  });
  Schedule.createAnyTimeOnce = function createAnyTimeOnce() {
    return Schedule.create({
      schedRecurrence: Recurrence.NONE,
      schedApprovals: 1
    });
  };
  Schedule.createAnyTimeLimited = function createAnyTimeLimited(activationLimit) {
    return Schedule.create({
      schedRecurrence: Recurrence.NONE,
      schedApprovals: activationLimit
    });
  };
  Schedule.createAnyTimeUnLimited = function createAnyTimeUnLimited() {
    return Schedule.create({
      schedRecurrence: Recurrence.NONE,
      schedApprovals: 0
    });
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Reward
   */
  var Reward = Soomla.Models.Reward = declareClass("Reward", {
    schedule: null,
    take: function take() {
      if (!Soomla.rewardStorage.isRewardGiven(this)) {
        logDebug("Reward not given. id: " + id);
        return false;
      }

      if (this.takeInner()) {
        Soomla.rewardStorage.setRewardStatus(this, false);
        return true;
      }

      return false;
    },
    give: function give() {
      if (!this.schedule.approve(Soomla.rewardStorage.getTimesGiven(this))) {
        logDebug("(Give) Reward is not approved by Schedule. id: " + this.itemId);
        return false;
      }

      if (this.giveInner()) {
        Soomla.rewardStorage.setRewardStatus(this, true);
        return true;
      }

      return false;
    },
    isOwned: function isOwned() {
      return Soomla.rewardStorage.isRewardGiven(this);
    },
    takeInner: function takeInner() {
      return new Error("takeInner is not implemented");
    },
    giveInner: function giveInner() {
      return new Error("giveInner is not implemented");
    },
    onCreate: function () {
      Reward.addReward(this);
    }
  }, SoomlaEntity);

  Reward.rewardsMap = {};

  Reward.getReward = function(id) {
    if (id in Soomla.Models.Reward.rewardsMap) {
      return Soomla.Models.Reward.rewardsMap[id];
    }

    return null;
  };

  Reward.addReward = function(reward) {
    Soomla.Models.Reward.rewardsMap[reward.itemId] = reward;
  };

  /**
   * AggregateReward
   */
  var AggregateReward = Soomla.Models.AggregateReward = declareClass("AggregateReward", {
    rewards: null
  }, Reward);

  /**
   * BadgeReward
   */
  var BadgeReward = Soomla.Models.BadgeReward = declareClass("BadgeReward", {
    iconUrl: null,
    takeInner: function takeInner() {
      // nothing to do here... the parent Reward takes in storage
      return true;
    },
    giveInner: function giveInner() {
      // nothing to do here... the parent Reward gives in storage
      return true;
    }
  }, Reward);

  /**
   * RandomReward
   */
  var RandomReward = Soomla.Models.RandomReward = declareClass("RandomReward", {
    lastGivenReward: null,
    takeInner: function takeInner() {
      // for now is able to take only last given
      if (this.lastGivenReward == null) {
        return false;
      }

      var taken = this.lastGivenReward.take();
      this.lastGivenReward = null;

      return taken;
    },
    giveInner: function giveInner() {
      var randomReward = _.sample(this.rewards);
      randomReward.give();
      this.lastGivenReward = randomReward;

      return true;
    }
  }, AggregateReward);

  /**
   * SequenceReward
   */
  var SequenceReward = Soomla.Models.SequenceReward = declareClass("SequenceReward", {
    takeInner: function takeInner() {
      var idx = Soomla.rewardStorage.getLastSeqIdxGiven(this);
      if (idx <= 0) {
        return false; // all rewards in the sequence were taken
      }
      Soomla.rewardStorage.setLastSeqIdxGiven(this, --idx);
      return true;
    },
    giveInner: function giveInner() {
      var idx = Soomla.rewardStorage.getLastSeqIdxGiven(this);
      if (idx >= this.rewards.length) {
        return false; // all rewards in the sequence were given
      }
      Soomla.rewardStorage.setLastSeqIdxGiven(this, ++idx);
      return true;
    },
    getLastGivenReward: function getLastGivenReward() {
      var idx = Soomla.rewardStorage.getLastSeqIdxGiven(this);
      if (idx < 0) {
        return null;
      }
      return this.rewards[idx];
    },
    hasMoreToGive: function hasMoreToGive() {
      return Soomla.rewardStorage.getLastSeqIdxGiven(this) < this.rewards.length;
    },
    forceNextRewardToGive: function forceNextRewardToGive(reward) {
      for (var i = 0; i < this.rewards.length; i++) {
        if (reward.equals(this.reward[i])) {
          Soomla.rewardStorage.setLastSeqIdxGiven(this, i - 1);
          return true;
        }
      }
      return false;
    }
  }, AggregateReward);


  //------ Store ------//
  /**
   * VirtualItem
   */
  var VirtualItem = Soomla.Models.VirtualItem = declareClass("VirtualItem", {
    save: function () {
      Soomla.storeInfo.saveItem(this);
    }
  }, SoomlaEntity);

  /**
   * VirtualCategory
   */
  var VirtualCategory = Soomla.Models.VirtualCategory = declareClass("VirtualCategory", {
    name: "",
    goods_itemIds: null
  }, Domain);

  /**
   * MarketItem
   */
  var MarketItem = Soomla.Models.MarketItem = declareClass("MarketItem", {
    productId: null,
    consumable: null,
    price: null,
    marketPrice: null,
    marketTitle: null,
    marketDesc: null,
    marketCurrencyCode: null,
    marketPriceMicros: 0
  }, Domain);
  MarketItem.Consumable = {
    NONCONSUMABLE: 0,
    CONSUMABLE: 1,
    SUBSCRIPTION: 2
  };

  var PURCHASE_TYPE = {
    MARKET: "market",
    VI: "virtualItem"
  };

  /**
   * PurchasableVirtualItem
   */
  var PurchasableVirtualItem = Soomla.Models.PurchasableVirtualItem = declareClass("PurchasableVirtualItem", {
    purchasableItem: null
  }, VirtualItem);

  /**
   * VirtualCurrency
   */
  var VirtualCurrency = Soomla.Models.VirtualCurrency = declareClass("VirtualCurrency", {
  }, VirtualItem);

  /**
   * VirtualCurrencyPack
   */
  var VirtualCurrencyPack = Soomla.Models.VirtualCurrencyPack = declareClass("VirtualCurrencyPack", {
    currency_amount: 0,
    currency_itemId: null
  }, PurchasableVirtualItem);

  /**
   * VirtualGood
   */
  var VirtualGood = Soomla.Models.VirtualGood = declareClass("VirtualGood", {
  }, PurchasableVirtualItem);

  /**
   * LifetimeVG
   */
  var LifetimeVG = Soomla.Models.LifetimeVG = declareClass("LifetimeVG", {
  }, VirtualGood);

  /**
   * EquippableVG
   */
  var EquippableVG = Soomla.Models.EquippableVG = declareClass("EquippableVG", {
    equipping: null
  }, LifetimeVG);
  EquippableVG.EquippingModel = {
    LOCAL: "local",
    CATEGORY: "category",
    GLOBAL: "global"
  };

  /**
   * SingleUseVG
   */
  var SingleUseVG = Soomla.Models.SingleUseVG = declareClass("SingleUseVG", {
  }, VirtualGood);

  /**
   * SingleUsePackVG
   */
  var SingleUsePackVG = Soomla.Models.SingleUsePackVG = declareClass("SingleUsePackVG", {
    good_itemId: null,
    good_amount: null
  }, VirtualGood);

  /**
   * UpgradeVG
   */
  var UpgradeVG = Soomla.Models.UpgradeVG = declareClass("UpgradeVG", {
    good_itemId: null,
    prev_itemId: null,
    next_itemId: null
  }, VirtualGood);

  /**
   * PurchaseType
   */
  var PurchaseType = Soomla.Models.PurchaseType = declareClass("PurchaseType", {
    purchaseType: null
  });

  /**
   * PurchaseWithMarket
   */
  var PurchaseWithMarket = Soomla.Models.PurchaseWithMarket = declareClass("PurchaseWithMarket", {
    purchaseType: PURCHASE_TYPE.MARKET,
    marketItem: null
  }, PurchaseType);

  PurchaseWithMarket.createWithMarketItem = function(productId, price) {
    var marketItem = MarketItem.create({
      productId: productId,
      consumable: MarketItem.Consumable.CONSUMABLE,
      price: price
    });
    return PurchaseWithMarket.create({marketItem: marketItem});
  };

  /**
   * PurchaseWithVirtualItem
   */
  var PurchaseWithVirtualItem = Soomla.Models.PurchaseWithVirtualItem = declareClass("PurchaseWithVirtualItem", {
    purchaseType: PURCHASE_TYPE.VI,
    pvi_itemId: null,
    pvi_amount: null
  }, PurchaseType);

  /**
   * VirtualItemReward
   */
  var VirtualItemReward = Soomla.Models.VirtualItemReward = declareClass("VirtualItemReward", {
    amount: null,
    associatedItemId : null,
    takeInner: function takeInner() {
      Soomla.storeInventory.takeItem(this.associatedItemId, this.amount);
      return true;
    },
    giveInner: function giveInner() {
      Soomla.storeInventory.giveItem(this.associatedItemId, this.amount);
    }
  }, Reward);


  //------ Profile ------//
  /**
   * UserProfile
   */
  var UserProfile = Soomla.Models.UserProfile = declareClass("UserProfile", {
    provider: null,
    profileId: null,
    email: null,
    firstName: null,
    lastName: null,
    avatarLink: null,
    location: null,
    gender: null,
    language: null,
    birthday: null
  }, Domain);

  var Provider = Soomla.Models.Provider = {
    FACEBOOK: {id: 0, key: 'facebook'},
    GOOGLE: {id: 2, key: 'google'},
    TWITTER: {id: 5, key: 'twitter'}
  };

  Provider.findById = function(id) {
    return _.find(Soomla.Models.Provider, function(provider) {
      return !_.isFunction(provider) && provider.id == id;
    })
  };
  Provider.findByKey = function(key) {
    return _.find(Soomla.Models.Provider, function(provider) {
      return !_.isFunction(provider) && provider.key == key;
    });
  };

  var SocialActionType = Soomla.Models.SocialActionType = {
    UPDATE_STATUS: 0,
    UPDATE_STORY: 1,
    UPLOAD_IMAGE: 2,
    GET_CONTACTS: 3,
    GET_FEED: 4
  };


  function extractModel(retParams) {
    return retParams.return;
  }

  function extractCollection(retParams) {
    var retArray = retParams.return || [];

    var result = [];
    for (var i = 0; i < retArray.length; i++) {
      result.push(retArray[i]);
    }
    return result;
  }

  //------ Highway ------//

  var Gift = Soomla.Models.Gift = declareClass("Gift", {
    giftId : null,
    fromUid : null,
    toProvider : null,
    toProfileId : null,
    payload : null

  }, Domain);

  var GiftPayload = Soomla.Models.GiftPayload = declareClass("GiftPayload", {
    associatedItemId : null,
    itemsAmount : null

  }, Domain);

  var MetaDataSyncError = Soomla.Models.MetaDataSyncError = {
    METADATA_GENERAL_ERROR: 0,
    METADATA_SERVER_ERROR: 1,
    METADATA_UPDATE_MODEL_ERROR: 2
  };

  var StateSyncError = Soomla.Models.StateSyncError = {
    STATE_GENERAL_ERROR: 0,
    STATE_SERVER_ERROR: 1,
    STATE_UPDATE_STATE_ERROR: 2
  };

  // ------- Core -------- //
  /**
   * Soomla
   */
  Soomla.DB_KEY_PRFIX = 'soomla.';
  Soomla.initialize = function initialize(soomlaSecret) {
    if (!soomlaSecret || soomlaSecret.length == 0) {
      logError("Can't initialize SOOMLA without soomlaSecret");
      return false;
    }

    Soomla.coreBridge = platform.isNativeSupported() ? NativeCoreBridge.create() : BridgelessCoreBridge.create();

    callNative({
      method: "CCSoomla::initialize",
      soomlaSecret: soomlaSecret
    });

    return true;
  };

  /**
   * NativeCoreBridge
   */
  var NativeCoreBridge = Soomla.NativeCoreBridge = declareClass("NativeCoreBridge", {
    ctor: function () {
      this.bindNative();
    },
    bindNative: function () {
      logDebug('Binding to native platform bridge...');
      if (platform.isAndroid()) {
        jsb.reflection.callStaticMethod('com/soomla/cocos2dx/common/CoreBridgeBinder', "bind", "()V");
      } else if (platform.isIos()) {
        jsb.reflection.callStaticMethod('CoreBridge', 'initShared');
      } else {
        logError('Unsupported platform: ' + platform.name);
      }
    }
  });

  /**
   * BridgelessCoreBridge
   */
  var BridgelessCoreBridge = Soomla.BridgelessCoreBridge = declareClass("BridgelessCoreBridge", {
  });


  /**
   * NativeKeyValueStorage
   */
  var NativeKeyValueStorage = Soomla.NativeKeyValueStorage = declareClass("NativeKeyValueStorage", {
    getValue: function getValue(key) {
      var result = callNative({
        method: "CCNativeKeyValueStorage::getValue",
        key: key
      });
      return result.return;
    },
    setValue: function setValue(key, val) {
      callNative({
        method: "CCNativeKeyValueStorage::setValue",
        key: key,
        val: val
      });
    },
    deleteKeyValue: function deleteKeyValue(key) {
      callNative({
        method: "CCNativeKeyValueStorage::deleteKeyValue",
        key: key
      });
    },
    purge: function purge() {
      callNative({
        method: "CCNativeKeyValueStorage::purge"
      });
    }
  });

  /**
   * BridgelessKeyValueStorage
   */
  var BridgelessKeyValueStorage = Soomla.BridgelessKeyValueStorage = declareClass("BridgelessKeyValueStorage", {
    KEY_VALUE_STORAGE_KEY: 'soomla.kvs.keys',
    mStoredKeys: [],

    ctor: function () {
      this.loadStoredKeys();
    },

    getValue: function getValue(key) {
      var defaultValue = "";
      var result = cc.sys.localStorage.getItem(key);
      return result || defaultValue;
    },
    setValue: function setValue(key, val) {
      cc.sys.localStorage.setItem(key, val);

      this.addStoredKeys(key);
      this.saveStoredKeys();
    },
    deleteKeyValue: function deleteKeyValue(key) {
      cc.sys.localStorage.removeItem(key);

      this.removeStoredKeys(key);
      this.saveStoredKeys();
    },
    purge: function purge() {
      _.forEach(this.mStoredKeys, function (key) {
        this.deleteKeyValue(key);
      }, this);

      cc.sys.localStorage.setItem(this.KEY_VALUE_STORAGE_KEY, "");
    },

    addStoredKeys: function (key) {
      if (this.mStoredKeys.indexOf(key) < 0) {
        this.mStoredKeys.push(key);
      }
    },
    removeStoredKeys: function (key) {
      var idx = this.mStoredKeys.indexOf(key);
      if (idx >= 0) {
        this.mStoredKeys.splice(idx, 1);
      }
    },
    saveStoredKeys: function () {
      cc.sys.localStorage.setItem(this.KEY_VALUE_STORAGE_KEY, JSON.stringify(this.mStoredKeys));
    },
    loadStoredKeys: function () {
      var strKeys = cc.sys.localStorage.getItem(this.KEY_VALUE_STORAGE_KEY);
      if (strKeys) {
        this.mStoredKeys = JSON.parse(strKeys);
      }
    }
  });

  Soomla.keyValueStorage = platform.isNativeSupported() ? NativeKeyValueStorage.create() : BridgelessKeyValueStorage.create();

  /**
   * NativeRewardStorage
   */
  var NativeRewardStorage = Soomla.NativeRewardStorage = declareClass("NativeRewardStorage", {
    setRewardStatus: function setRewardStatus(reward, give, notify) {
      notify = notify || notify == undefined;
      callNative({
        method: "CCNativeRewardStorage::setRewardStatus",
        reward: reward,
        give: give,
        notify: notify
      });
    },
    getTimesGiven: function getTimesGiven(reward) {
      var result = callNative({
        method: "CCNativeRewardStorage::getTimesGiven",
        reward: reward
      });
      return result.return;
    },
    isRewardGiven: function isRewardGiven(reward) {
      return this.getTimesGiven(reward) > 0;
    },
    getLastSeqIdxGiven: function getLastSeqIdxGiven(sequenceReward) {
      var result = callNative({
        method: "CCNativeRewardStorage::getLastSeqIdxGiven",
        reward: sequenceReward
      });
      return result.return;
    },
    setLastSeqIdxGiven: function setLastSeqIdxGiven(sequenceReward, idx) {
      callNative({
        method: "CCNativeRewardStorage::setLastSeqIdxGiven",
        reward: sequenceReward,
        idx: idx
      });
    }
  });

  /**
   * BridgelessRewardStorage
   */
  var BridgelessRewardStorage = Soomla.BridgelessRewardStorage = declareClass("BridgelessRewardStorage", {
    setRewardStatus: function setRewardStatus(reward, give, notify) {
      notify = notify || notify === undefined;
      this.setTimesGiven(reward, give, notify);
    },
    getTimesGiven: function getTimesGiven(reward) {
      var key = this.keyRewardTimesGiven(reward.getId());
      var val = Soomla.keyValueStorage.getValue(key);
      return (!_.isUndefined(val) && !_.isNull(val)) ? val : 0;
    },
    isRewardGiven: function isRewardGiven(reward) {
      return this.getTimesGiven(reward) > 0;
    },
    getLastSeqIdxGiven: function getLastSeqIdxGiven(sequenceReward) {
      var key = this.keyRewardIdxSeqGiven(sequenceReward.getId());
      var val = Soomla.keyValueStorage.getValue(key);
      return (!_.isUndefined(val) && !_.isNull(val)) ? val : -1;
    },
    setLastSeqIdxGiven: function setLastSeqIdxGiven(sequenceReward, idx) {
      var key = this.keyRewardIdxSeqGiven(sequenceReward.getId());
      Soomla.keyValueStorage.setValue(key, idx);
    },


    setTimesGiven: function setTimesGiven(reward, up, notify) {
      var total = this.getTimesGiven(reward) + (up ? 1 : -1);
      if (total < 0) {
        total = 0;
      }

      var key = this.keyRewardTimesGiven(reward.getId());
      Soomla.keyValueStorage.setValue(key, total);

      if (up) {
        key = this.keyRewardLastGiven(reward.getId());
        Soomla.keyValueStorage.setValue(key, Date.now());
      }

      if (notify) {
        if (up) {
          Soomla.dispatchEvent('onRewardGivenEvent', reward);
        } else {
          Soomla.dispatchEvent('onRewardTakenEvent', reward);
        }
      }
    },
    keyRewards: function keyRewards(rewardId, postfix) {
      return Soomla.DB_KEY_PRFIX + 'rewards.' + rewardId + '.' + postfix;
    },
    keyRewardIdxSeqGiven: function keyRewardIdxSeqGiven(rewardId) {
      return this.keyRewards(rewardId, "seq.id");
    },
    keyRewardTimesGiven: function keyRewardTimesGiven(rewardId) {
      return this.keyRewards(rewardId, "timesGiven");
    },
    keyRewardLastGiven: function keyRewardLastGiven(rewardId) {
      return this.keyRewards(rewardId, "lastGiven");
    }
  });

  Soomla.rewardStorage = platform.isNativeSupported() ? NativeRewardStorage.create() : BridgelessRewardStorage.create();

  // ------- Store -------- //
  /**
   * VirtualItemStorage
   */
  var VirtualItemStorage = Soomla.VirtualItemStorage = declareClass("VirtualItemStorage", {
    getBalance: function getBalance(item) {
      var itemId = item.getId();
      var key = this.keyBalance(itemId);
      var val = Soomla.keyValueStorage.getValue(key);

      var balance = !_.isUndefined(val) ? balance : 0;

      logDebug('the balance for ' + itemId + ' is ' + balance);
  
      return balance;
    },

    setBalance: function setBalance(item, balance, notify) {
      var oldBalance = this.getBalance(item);
      if (oldBalance === balance) {
        return balance;
      }

      var itemId = item.getId();
      var key = this.keyBalance(itemId);

      Soomla.keyValueStorage.setValue(key, balance);

      if (notify) {
        this.postBalanceChangeEvent(item, balance, 0);
      }

      return balance;
    },

    add: function add(item, amount, notify) {
      var itemId = item.getId();
      var balance = this.getBalance(item);
      if (balance < 0) { /* in case the user "adds" a negative value */
        balance = 0;
        amount = 0;
      }

      var newBalance = balance + amount;
      var key = this.keyBalance(itemId);

      Soomla.keyValueStorage.setValue(key, newBalance);

      if (notify) {
        this.postBalanceChangeEvent(item, newBalance, amount);
      }

      return newBalance;
    },

    remove: function remove(item, amount, notify) {
      var itemId = item.getId().getCString();
      var balance = this.getBalance(item) - amount;
      if (balance < 0) {
        balance = 0;
        amount = 0;
      }

      var key = this.keyBalance(itemId);

      Soomla.keyValueStorage.setValue(key, balance);

      if (notify) {
        this.postBalanceChangeEvent(item, balance, -1 * amount);
      }

      return balance;
    },

    keyBalance: function keyBalance(itemId) {
      logError('OVERRIDE ME!')
    },

    postBalanceChangeEvent: function (item, balance, amountAdded) {
      logError('OVERRIDE ME!')
    }
  });

  /**
   * VirtualCurrencyStorage
   */
  var VirtualCurrencyStorage = Soomla.VirtualCurrencyStorage = declareClass("VirtualCurrencyStorage", {
    keyBalance: function keyBalance(itemId) {
      return this.keyCurrencyBalance(itemId);
    },
    postBalanceChangeEvent: function postBalanceChangeEvent(item, balance, amountAdded) {
      Soomla.dispatchEvent('onCurrencyBalanceChanged', item, balance, amountAdded);
    },
    keyCurrencyBalance: function keyCurrencyBalance(itemId) {
      return 'currency.' + itemId + '.balance';
    }
  }, VirtualItemStorage);

  /**
   * NativeVirtualCurrencyStorage
   */
  var NativeVirtualCurrencyStorage = Soomla.NativeVirtualCurrencyStorage = declareClass("NativeVirtualCurrencyStorage", {

    getBalance: function getBalance(item) {
      var itemId = item.getId();
  
      logDebug('SOOMLA/COCOS2DX Calling getBalance with: ' + itemId);
      var retParams = callNative({
        method: 'CCNativeVirtualCurrencyStorage::getBalance',
        itemId: itemId
      });

      return retParams['return'] || 0;
    },

    setBalance: function setBalance(item, balance, notify) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling setBalance with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualCurrencyStorage::setBalance',
        itemId: itemId,
        balance: balance,
        notify: notify
      });

      return retParams['return'] || 0;
    },

    add: function add(item, amount, notify) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling add with: %s' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualCurrencyStorage::add',
        itemId: itemId,
        amount: amount,
        notify: notify
      });

      return retParams['return'] || 0;
    },

    remove: function remove(item, amount, notify) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling remove with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualCurrencyStorage::remove',
        itemId: itemId,
        amount: amount,
        notify: notify
      });

      return retParams['return'] || 0;
    }

  }, VirtualCurrencyStorage);

  Soomla.virtualCurrencyStorage = platform.isNativeSupported() ? NativeVirtualCurrencyStorage.create() : VirtualCurrencyStorage.create();

  /**
   * VirtualGoodsStorage
   */
  var VirtualGoodsStorage = Soomla.VirtualGoodsStorage = declareClass("VirtualGoodsStorage", {
    /**
     Removes any upgrade associated with the given `CCVirtualGood`.
     @param good `CCVirtualGood` to remove upgrade from.
     @param notify true will also post event.
     */
    removeUpgrades: function removeUpgrades(good, notify) {
      notify = notify || _.isUndefined(notify);
      var itemId = good.getId();
      var key = this.keyGoodUpgrade(itemId);

      Soomla.keyValueStorage.deleteKeyValue(key);

      if (notify) {
        Soomla.dispatchEvent('onGoodUpgrade', good);
      }
    },

    /**
     Assigns a specific upgrade to the given virtual good.
     @param good `CCVirtualGood` to remove upgrade from.
     @param upgradeVG the upgrade to assign.
     @param notify true will also post event.
     */
    assignCurrentUpgrade: function assignCurrentUpgrade(good, upgradeVG, notify) {
      notify = notify || _.isUndefined(notify);
      var upgrade = this.getCurrentUpgrade(good);
      if (upgrade && upgrade.getId() === upgradeVG.getId()) {
        return;
      }

      var itemId = good.getId();
      var key = this.keyGoodUpgrade(itemId);
      var upItemId = upgradeVG.getId();

      Soomla.keyValueStorage.setValue(key, upItemId);

      if (notify) {
        Soomla.dispatchEvent('onGoodUpgrade', good, upgradeVG);
      }
    },

    /**
     Retrieves the current upgrade for the given virtual good.
     @param good the virtual good to retrieve upgrade for.
     @return the current upgrade for the given virtual good, or NULL if one
     does not exist
     */
    getCurrentUpgrade: function getCurrentUpgrade(good) {
      var itemId = good.getId();
      var key = this.keyGoodUpgrade(itemId);

      var upItemId = Soomla.keyValueStorage.getValue(key);

      if (!upItemId) {
        logDebug('You tried to fetch the current upgrade of ' + itemId + ' but there\'s not upgrade to it.');
        return null;
      }

      var item = Soomla.storeInfo.getItemByItemId(upItemId);

      return item || null;
    },

    /**
     Checks the equipping status of the given `CCEquippableVG`.
     @param good The `CCEquippableVG` to check the status for.
     @return boolean true if the good is equipped, false otherwise
     */
    isEquipped: function isEquipped(good) {
      var itemId = good.getId();
      var key = this.keyGoodEquipped(itemId);
      var val = Soomla.keyValueStorage.getValue(key);

      return !!val;
    },

    /**
     Equips the given `CCEquippableVG`.
     @param good The `CCEquippableVG` to equip.
     @param notify true will also post event.
     @param error Gets A `CCError` for error checking.
     */
    equip: function equip(good, notify) {
      notify = notify || _.isUndefined(notify);
      if (this.isEquipped(good)) {
        return;
      }

      this.equipPriv(good, true, notify);
    },

    /**
     UnEquips the given `CCEquippableVG`.
     @param good The `CCEquippableVG` to unequip.
     @param notify true will also post event.
     @param error Gets A `CCError` for error checking.
     */
    unequip: function unequip(good, notify) {
      notify = notify || _.isUndefined(notify);
      if (this.isEquipped(good)) {
        return;
      }

      this.equipPriv(good, false, notify);
    },


    keyBalance: function keyBalance(itemId) {
      this.keyGoodBalance(itemId);
    },

    postBalanceChangeEvent: function postBalanceChangeEvent(item, balance, amountAdded) {
      Soomla.dispatchEvent('onGoodBalanceChanged', item, balance, amountAdded);
    },

    equipPriv: function equipPriv(good, equip, notify) {
      var itemId = good.getId();
      var key = this.keyGoodEquipped(itemId);

      if (equip) {
        Soomla.keyValueStorage.setValue(key, 'yes');
        if (notify) {
          Soomla.dispatchEvent('onGoodEquipped', good);
        }
      } else {
        Soomla.keyValueStorage.deleteKeyValue(key);
        if (notify) {
          Soomla.dispatchEvent('onGoodUnEquipped', good);
        }
      }
    },

    keyGoodBalance: function keyGoodBalance(itemId) {
      return 'good.' + itemId + '.balance';
    },

    keyGoodEquipped: function keyGoodEquipped(itemId) {
      return 'good.' + itemId + '.equipped';
    },

    keyGoodUpgrade: function keyGoodUpgrade(itemId) {
      return 'good.' + itemId + '.currentUpgrade';
    }

  }, VirtualItemStorage);

  /**
   Implements the `CCVirtualGoodsStorage` using the bridge to talk
   with the native implementation of VirtualGoodsStorage

   See parent for all functions.
   */
  var NativeVirtualGoodsStorage = Soomla.NativeVirtualGoodsStorage = declareClass("NativeVirtualGoodsStorage", {

    getBalance: function getBalance(item) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling getBalance with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualGoodsStorage::getBalance',
        itemId: itemId
      });

      return retParams['return'] || 0;
    },

    setBalance: function setBalance(item, balance, notify) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling setBalance with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualGoodsStorage::setBalance',
        itemId: itemId,
        balance: balance,
        notify: notify
      });

      return retParams['return'] || 0;
    },

    add: function add(item, amount, notify) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling add with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualGoodsStorage::add',
        itemId: itemId,
        amount: amount,
        notify: notify
      });

      return retParams['return'] || 0;
    },

    remove: function remove(item, amount, notify) {
      var itemId = item.getId();

      logDebug('SOOMLA/COCOS2DX Calling remove with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualGoodsStorage::remove',
        itemId: itemId,
        amount: amount,
        notify: notify
      });

      return retParams['return'] || 0;
    },

    removeUpgrades: function removeUpgrades(good, notify) {
      var itemId = good.getId();

      logDebug('SOOMLA/COCOS2DX Calling removeUpgrades with: ' + itemId);

      callNative({
        method: 'CCNativeVirtualGoodsStorage::removeUpgrades',
        itemId: itemId,
        notify: notify
      });
    },

    assignCurrentUpgrade: function assignCurrentUpgrade(good, upgradeVG, notify) {
      var itemId = good.getId();
      var upgradeItemId = upgradeVG.getId();


      logDebug('SOOMLA/COCOS2DX Calling assignCurrentUpgrade with: ' + itemId);

      callNative({
        method: 'CCNativeVirtualGoodsStorage::assignCurrentUpgrade',
        itemId: itemId,
        upgradeItemId: upgradeItemId,
        notify: notify
      });
    },

    getCurrentUpgrade: function getCurrentUpgrade(good) {
      var itemId = good.getId();

      logDebug('SOOMLA/COCOS2DX Calling getCurrentUpgrade with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualGoodsStorage::getCurrentUpgrade',
        itemId: itemId
      });

      var retItemId = retParams['return'];

      return retItemId ? Soomla.storeInfo.getItemByItemId(retItemId) : null;
    },

    isEquipped: function isEquipped(good) {
      var itemId = good.getId();

      logDebug('SOOMLA/COCOS2DX Calling isEquipped with: ' + itemId);

      var retParams = callNative({
        method: 'CCNativeVirtualGoodsStorage::isEquipped',
        itemId: itemId
      });

      return retParams['return'] || false;
    },

    equip: function equip(good, notify) {
      var itemId = good.getId();

      logDebug('SOOMLA/COCOS2DX Calling equip with: ' + itemId);

      callNative({
        method: 'CCNativeVirtualGoodsStorage::equip',
        itemId: itemId,
        notify: notify
      });
    },

    unequip: function unequip(good, notify) {
      var itemId = good.getId();

      logDebug('SOOMLA/COCOS2DX Calling unequip with: ' + itemId);

      callNative({
        method: 'CCNativeVirtualGoodsStorage::unequip',
        itemId: itemId,
        notify: notify
      });
    }
  }, VirtualGoodsStorage);

  Soomla.virtualGoodsStorage = platform.isNativeSupported() ? NativeVirtualGoodsStorage.create() : VirtualGoodsStorage.create();

  /**
   * StoreInfo
   */
  var StoreInfo = Soomla.StoreInfo = declareClass("StoreInfo", {
    KEY_META_STORE_INFO: "meta.storeinfo",

    virtualItems: null,
    purchasableItems: null,
    goodsCategories: null,
    goodsUpgrades: null,
    currencies: null,
    currencyPacks: null,
    goods: null,
    categories: null,

    init: function(storeAssets) {

      Soomla.logDebug('Setting store assets in SoomlaInfo');

      if (!storeAssets){
        Soomla.logDebug('The given store assets can\'t be null!');
        return false;
      }

      var _this = this;
      // support reflection call to initializeFromDB
      Soomla.addEventHandler({
        initializeFromDB: function () {
          _this.initializeFromDB();
        }
      });

      this.setStoreAssets(storeAssets);

      // At this point we have StoreInfo JSON saved at the local key-value storage. We can just
      // continue by initializing from DB.

      this.initializeFromDB();

      return true;
    },

    setStoreAssets: function (storeAssets) {
      var jsonString = JSON.stringify(storeAssets);
      Soomla.keyValueStorage.setValue(this.KEY_META_STORE_INFO, jsonString);
    },

    initializeFromDB: function () {
      var val = Soomla.keyValueStorage.getValue(this.KEY_META_STORE_INFO);

      if (!val){
        var message = 'store json is not in DB. Make sure you initialized SoomlaStore with your Store assets. The App will shut down now.';
        logError(message);
        throw message;
      }

      logDebug('the metadata-economy json (from DB) is ' + val);

      this.currencies = val.currencies;
      this.currencyPacks = val.currencyPacks;
      if (val.goods) {
        this.goods = _.union(
          val.goods.singleUse,
          val.goods.lifetime,
          val.goods.equippable,
          val.goods.goodPacks,
          val.goods.goodUpgrades
        );
      } else {
        this.goods = [];
      }
      this.categories = val.categories;


      this.virtualItems = _.groupBy(_.union(this.currencies, this.currencyPacks, this.goods), 'itemId');

      this.purchasableItems = _.groupBy(
        _.filter(_.union(this.currencyPacks, this.goods),
          function (vi) {
            return vi.purchasableItem && vi.purchasableItem.marketItem;
          }
        ),
        function (vi) {
          return vi.purchasableItem.marketItem.productId;
        }
      );
      this.goodsUpgrades = _.groupBy(_.filter(this.goods, {className: 'UpgradeVG'}), 'goodItemId');

      var goodsCategories = this.goodsCategories = {};
      _.each(this.categories, function (category) {
        _.each(category.goods_itemIds, function (itemId) {
          goodsCategories[itemId] = category;
        });
      });
    },

    getItemByItemId: function(itemId) {
      var retParams = callNative({
        method: "CCStoreInfo::getItemByItemId",
        itemId: itemId
      });
      return extractModel(retParams);
    },
    getPurchasableItemWithProductId: function(productId) {
      var retParams = callNative({
        method: "CCStoreInfo::getPurchasableItemWithProductId",
        productId: productId
      });
      return extractModel(retParams);
    },
    getCategoryForVirtualGood: function(goodItemId) {
      var retParams = callNative({
        method: "CCStoreInfo::getCategoryForVirtualGood",
        goodItemId: goodItemId
      });
      return extractModel(retParams);
    },
    getFirstUpgradeForVirtualGood: function(goodItemId) {
      var retParams = callNative({
        method: "CCStoreInfo::getFirstUpgradeForVirtualGood",
        goodItemId: goodItemId
      });
      return extractModel(retParams);
    },
    getLastUpgradeForVirtualGood: function(goodItemId) {
      var retParams = callNative({
        method: "CCStoreInfo::getLastUpgradeForVirtualGood",
        goodItemId: goodItemId
      });
      return extractModel(retParams);
    },
    getUpgradesForVirtualGood: function(goodItemId) {
      var retParams = callNative({
        method: "CCStoreInfo::getUpgradesForVirtualGood",
        goodItemId: goodItemId
      });

      return extractCollection(retParams);
    },

    getVirtualItems: function () {
      return this.virtualItems;
    },

    getPurchasableItems: function () {
      return this.purchasableItems;
    },

    getGoodsCategories: function () {
      return this.goodsCategories;
    },

    getGoodsUpgrades: function () {
      return this.goodsUpgrades;
    },

    getCurrencies: function () {
      return this.currencies;
    },

    getCurrencyPacks: function () {
      return this.currencyPacks;
    },

    getGoods: function () {
      return this.goods;
    },

    getCategories: function () {
      return this.categories;
    },

    saveItem: function (virtualItem, saveToDB) {
      this.replaceVirtualItem(virtualItem);
      if (saveToDB) {
        this.save();
      }
    },
    saveItems: function(virtualItems, saveToDB) {
      if (!virtualItems || virtualItems.length == 0) {
        return;
      }

      _.each(virtualItems, function (vi) {
        this.replaceVirtualItem(vi);
      });

      if (saveToDB) {
        this.save();
      }
    },
    save: function () {
      var assets = Soomla.IStoreAssets.create();
      assets.currencies = this.currencies;
      assets.currencyPacks = this.currencyPacks;

      _.each(this.goods, function (vi) {
        if (vi.className === 'SingleUseVG') {
          assets.goods.singleUse.push(vi);
        } else if (vi.className === 'EquippableVG') {
          assets.goods.equippable.push(vi);
        } else if (vi.className === 'UpgradeVG') {
          assets.goods.goodUpgrades.push(vi);
        } else if (vi.className === 'LifetimeVG') {
          assets.goods.lifetime.push(vi);
        } else if (vi.className === 'SingleUsePackVG') {
          assets.goods.goodPacks.push(vi);
        }
      });
      assets.categories = this.categories;

      var jsonString = JSON.stringify(assets);
      logDebug("saving StoreInfo to DB. json is: " + jsonString);
      Soomla.keyValueStorage.setValue(this.KEY_META_STORE_INFO, jsonString);
    },

    replaceVirtualItem: function(virtualItem) {
      var foundIdx;
      this.virtualItems[virtualItem.itemId] = virtualItem;

      if (virtualItem.className === 'VirtualCurrency') {
        foundIdx = _.findIndex(this.currencies, {itemId: virtualItem.itemId});
        if (foundIdx >= 0) {
          _.slice(this.currencies, foundIdx);
        }
        this.currencies.push(virtualItem);
      }

      if (virtualItem.className === 'VirtualCurrencyPack') {
        if (virtualItem.purchasableItem && virtualItem.purchasableItem.marketItem) {
          this.purchasableItems[virtualItem.purchasableItem.marketItem.productId] = virtualItem;
        }

        foundIdx = _.findIndex(this.currencyPacks, {itemId: virtualItem.itemId});
        if (foundIdx >= 0) {
          _.slice(this.currencyPacks, foundIdx);
        }
        this.currencyPacks.push(virtualItem);
      }

      if (virtualItem.className === 'SingleUseVG' ||
        virtualItem.className === 'EquippableVG' ||
        virtualItem.className === 'UpgradeVG' ||
        virtualItem.className === 'LifetimeVG' ||
        virtualItem.className === 'SingleUsePackVG') {

        if (virtualItem.className === 'UpgradeVG') {
          foundIdx = _.findIndex(this.goodsUpgrades, {itemId: virtualItem.itemId});
          if (foundIdx >= 0) {
            _.slice(this.goodsUpgrades, foundIdx);
          }
          this.goodsUpgrades.push(virtualItem);
        }

        if (virtualItem.purchasableItem && virtualItem.purchasableItem.marketItem) {
          this.purchasableItems[virtualItem.purchasableItem.marketItem.productId] = virtualItem;
        }

        foundIdx = _.findIndex(this.goods, {itemId: virtualItem.itemId});
        if (foundIdx >= 0) {
          _.slice(this.goods, foundIdx);
        }
        this.goods.push(virtualItem);
      }
    }
  });

  var NativeStoreInfo = Soomla.NativeStoreInfo = declareClass("NativeStoreInfo", {
    setStoreAssets: function setStoreAssets(storeAssets) {
      logDebug('pushing CCStoreAssets to StoreInfo on native side');

      callNative({
        method: "CCStoreAssets::init",
        version: storeAssets.version,
        storeAssets: storeAssets
      });

      logDebug('done! (pushing data to StoreAssets on native side)');
    },
    save: function save() {
      StoreInfo.save.apply(this, arguments);

      callNative({
        method: "CCStoreInfo::loadFromDB"
      });
    }
  }, StoreInfo);

  StoreInfo.createShared = function(storeAssets) {
    var ret = platform.isNativeSupported() ? NativeStoreInfo.create() : StoreInfo.create();
    if (ret.init(storeAssets)) {
      Soomla.storeInfo = ret;
    } else {
      Soomla.storeInfo = null;
    }
  };

  var IStoreAssets = Soomla.IStoreAssets = declareClass("IStoreAssets", {
    categories: [],
    currencies: [],
    currencyPacks: [],
    goods: {
      singleUse: [],
      lifetime: [],
      equippable: [],
      goodUpgrades: [],
      goodPacks: []
    },
    version: 1
  });

// ------- Highway -------- //
  /**
   * Cocos2dXSoomlaHighway
   */
  var Cocos2dXSoomlaHighway = Soomla.Cocos2dXSoomlaHighway = declareClass("Cocos2dXSoomlaHighway", {
    init: function init(gameKey, envKey, highwayUrl, servicesUrl) {
      var result = callNative({
        method: "CCSoomlaHighway::init",
        gameKey: gameKey,
        envKey: envKey,
        highwayUrl: highwayUrl,
        servicesUrl: servicesUrl
      });
      return result.return;
    }
  });
  Cocos2dXSoomlaHighway.createShared = function(gameKey, envKey, highwayUrl, servicesUrl) {
    var ret = new Cocos2dXSoomlaHighway();
    if (ret.init(gameKey, envKey, highwayUrl, servicesUrl)) {
      Soomla.cocos2dXSoomlaHighway = ret;
    } else {
      Soomla.cocos2dXSoomlaHighway = null;
    }
  };

  /**
   * SoomlaSync
   */
  var SoomlaSync = Soomla.SoomlaSync = declareClass("SoomlaSync", {
    init: function init(metaDataSync, stateSync) {
      var result = callNative({
        method: "CCSoomlaSync::init",
        metaDataSync: metaDataSync,
        stateSync: stateSync
      });
      return result.return;
    },
    resetState : function() {
      var result = callNative({
        method: "CCSoomlaSync::resetState"
      });
      return result.return;
    },
    stateConflictResolver : function(remoteState, currentState, stateDiff) {
      return remoteState;
    },
    resolveStateConflict : function(remoteState, currentState, stateDiff) {
      var resolvedState = this.stateConflictResolver(remoteState, currentState, stateDiff);

      var conflictResolveStrategy = 2;
      if (_.isEqual(resolvedState, remoteState)) {
        conflictResolveStrategy = 0;
      }
      else if (_.isEqual(resolvedState, currentState)) {
        conflictResolveStrategy = 1;
      }

      var result = callNative({
        method: "CCSoomlaSync::resolveConflictCallback",
        conflictResolveStrategy: conflictResolveStrategy,
        resolvedState: resolvedState
      });
      return result.return;
    }
  });
  SoomlaSync.createShared = function(metaDataSync, stateSync) {
    var ret = new SoomlaSync();
    if (ret.init(metaDataSync, stateSync)) {
      Soomla.soomlaSync = ret;
    } else {
      Soomla.soomlaSync = null;
    }
  };

  /**
   * SoomlaGifting
   */
  var SoomlaGifting = Soomla.SoomlaGifting = declareClass("SoomlaGifting", {
    init: function init() {
      var result = callNative({
        method: "CCSoomlaGifting::init"
      });
      return result.return;
    },
    sendGift: function(toProvider, toProfileId, itemId, amount, deductFromUser) {
      if (_.isUndefined(deductFromUser)) {
        deductFromUser = false;
      }

      var result = callNative({
        method: "CCSoomlaGifting::sendGift",
        toProvider: toProvider,
        toProfileId: toProfileId,
        itemId: itemId,
        amount: amount,
        deductFromUser: deductFromUser
      });

      if (result.return) {
        return result.willStart;
      }

      return false;
    }
  });
  SoomlaGifting.createShared = function() {
    var ret = new SoomlaGifting();
    if (ret.init()) {
      Soomla.soomlaGifting = ret;
    } else {
      Soomla.soomlaGifting = null;
    }
  };

  /**
   * EventHandler
   */
  var EventHandler = Soomla.EventHandler = declareClass("EventHandler", {

    //------ Core ------//
    onRewardGivenEvent: function(reward) {},
    onRewardTakenEvent: function(reward) {},
    onCustomEvent: function(name, extra) {},

    //------ Store ------//
    onBillingNotSupported: function() {},
    onBillingSupported: function() {},
    onCurrencyBalanceChanged: function(virtualCurrency, balance, amountAdded) {},
    onGoodBalanceChanged: function(virtualGood, balance, amountAdded) {},
    onGoodEquipped: function(equippableVG) {},
    onGoodUnEquipped: function(equippableVG) {},
    onGoodUpgrade: function(virtualGood, upgradeVG) {},
    onItemPurchased: function(purchasableVirtualItem) {},
    onItemPurchaseStarted: function(purchasableVirtualItem) {},
    onMarketPurchaseCancelled: function(purchasableVirtualItem) {},
    onMarketPurchase: function(purchasableVirtualItem, token, payload) {},
    onMarketPurchaseStarted: function(purchasableVirtualItem) {},
    onMarketItemsRefreshStarted: function() {},
    onMarketItemsRefreshFailed: function(errorMessage) {},
    onMarketItemsRefreshed: function(marketItems) {},
    onMarketPurchaseVerification: function(purchasableVirtualItem) {},
    onRestoreTransactionsStarted: function() {},
    onRestoreTransactionsFinished: function(success) {},
    onUnexpectedErrorInStore: function() {},
    onSoomlaStoreInitialized: function() {},
    // For Android only
    onMarketRefund: function(purchasableVirtualItem) {},
    onIabServiceStarted: function() {},
    onIabServiceStopped: function() {},

    //------ Profile ------//
    /**
     * Called after the service has been initialized
     */
    onProfileInitialized: function() {},
    /**
     Called when the market page for the app is opened
     */
    onUserRatingEvent: function() {},

    /**
     Called when the login process to a provider has failed
     @param provider The provider on which the login has failed
     @param errorDescription a Description of the reason for failure
     @param payload an identification String sent from the caller of the action
     */
    onLoginFailed: function(provider, errorDescription, payload) {},

    /**
     Called when the login process finishes successfully
     @param userProfile The user's profile from the logged in provider
     @param payload an identification String sent from the caller of the action
     */
    onLoginFinished: function(userProfile, payload) {},

    /**
     Called when the login process to a provider has started
     @param provider The provider on where the login has started
     @param payload an identification String sent from the caller of the action
     */
    onLoginStarted: function(provider, payload) {},

    /**
     Called when the logout process from a provider has failed
     @param provider The provider on which the logout has failed
     @param errorDescription a Description of the reason for failure
     */
    onLogoutFailed: function(provider, errorDescription) {},

    /**
     Called when the logout process from a provider has finished
     @param provider The provider on which the logout has finished
     */
    onLogoutFinished: function(provider) {},

    /**
     Called when the logout process from a provider has started
     @param provider The provider on which the login has started
     */
    onLogoutStarted: function(provider) {},

    /**
     Called when the get contacts process from a provider has failed
     @param provider The provider on which the get contacts process has
     failed
     @param errorDescription a Description of the reason for failure
     @param payload an identification String sent from the caller of the action
     */
    onGetContactsFailed: function(provider, errorDescription, payload) {},

    /**
     Called when the get contacts process from a provider has finished
     @param provider The provider on which the get contacts process finished
     @param contactsDict an Array of contacts represented by CCUserProfile
     @param payload an identification String sent from the caller of the action
     */
    onGetContactsFinished: function(provider, contactsDict, payload) {},

    /**
     Called when the get contacts process from a provider has started
     @param provider The provider on which the get contacts process started
     @param payload an identification String sent from the caller of the action
     */
    onGetContactsStarted: function(provider, payload) {},

    /**
     Called when the get feed process from a provider has failed
     @param provider The provider on which the get feed process has
     failed
     @param errorDescription a Description of the reason for failure
     @param payload an identification String sent from the caller of the action
     */
    onGetFeedFailed: function(provider, errorDescription, payload) {},

    /**
     Called when the get feed process from a provider has finished
     @param provider The provider on which the get feed process finished
     @param feedList an Array of feed entries represented by __String
     @param payload an identification String sent from the caller of the action
     */
    onGetFeedFinished: function(provider, feedList, payload) {},

    /**
     Called when the get feed process from a provider has started
     @param provider The provider on which the get feed process started
     @param payload an identification String sent from the caller of the action
     */
    onGetFeedStarted: function(provider, payload) {},

    /**
     Called when a generic social action on a provider has failed
     @param provider The provider on which the social action has failed
     @param socialActionType The social action which failed
     @param errorDescription a Description of the reason for failure
     @param payload an identification String sent from the caller of the action
     */
    onSocialActionFailedEvent: function(provider, socialActionType, errorDescription, payload) {},

    /**
     Called when a generic social action on a provider has finished
     @param provider The provider on which the social action has finished
     @param socialActionType The social action which finished
     @param payload an identification String sent from the caller of the action
     */
    onSocialActionFinishedEvent: function(provider, socialActionType, payload) {},

    /**
     Called when a generic social action on a provider has started
     @param provider The provider on which the social action has started
     @param socialActionType The social action which started
     @param payload an identification String sent from the caller of the action
     */
    onSocialActionStartedEvent: function(provider, socialActionType, payload) {},

    /**
     Called the login process to a provider has been cancelled
     @param provider The provider on which the login has failed
     @param payload an identification String sent from the caller of the action
     */
    onLoginCancelledEvent: function(provider, payload) {},

    /**
     Called when a user profile from a provider has been retrieved
     @param userProfile The user's profile which was updated
     */
    onUserProfileUpdatedEvent: function(userProfile) {},

    //------ Highway ------//

    /**
     Fired when Soomla Sync is initialized.
     */
    onSoomlaSyncInitialized : function() {},
    /**
     Fired when the meta-data sync process has began.
     */
    onMetaDataSyncStarted : function() {},
    /**
     Fired when the meta-data sync process has finished.
     @param changedComponents a List of modules' names (string) which were synced.
     */
    onMetaDataSyncFinished : function(changedComponents) {},
    /**
     Fired when the meta-data sync process has failed.
     @param errorCode (MetaDataSyncError) The error code of the failure
     @param errorMessage The reason why the process failed
     */
    onMetaDataSyncFailed : function(errorCode, errorMessage) {},
    /**
     Fired when the state sync process has began.
     */
    onStateSyncStarted : function() {},
    /**
     Fired when the state sync process has finished.
     @param changedComponents a List of modules' names (string) which were updated.
     @param failedComponents a List of modules' names (string) which failed to update.
     */
    onStateSyncFinished : function(changedComponents, failedComponents) {},
    /**
     Fired when the state sync process has failed.
     @param errorCode (StateSyncError) The error code of the failure
     @param errorMessage The reason why the process failed
     */
    onStateSyncFailed : function(errorCode, errorMessage) {},
    /**
     Fired when the state reset process has began.
     */
    onStateResetStarted : function() {},
    /**
     Fired when the state reset process has finished.
     */
    onStateResetFinished : function() {},
    /**
     Fired when the state reset process has failed.
     @param errorCode (StateSyncError) The error code of the failure
     @param errorMessage The reason why the process failed
     */
    onStateResetFailed : function(errorCode, errorMessage) {},
    /**
     Fired when Soomla Gifting is initialized.
     */
    onSoomlaGiftingInitialized : function() {},
    /**
     Fired when gifting has started retrieving a list of gifts for the user.
     */
    onGiftsRetrieveStarted : function() {},
    /**
     Fired when the list of gifts for the user has been retrieved.
     NOTE: This event is fired just before the gifts are handed out
     to the user
     @param retrievedGifts a List of gifts (`Gift`) which will be handed
     out.
     */
    onGiftsRetrieveFinished : function(retrievedGifts) {},
    /**
     Fired when gifting failed to retrieve a list of gifts for the user.
     @param errorMessage The reason why the retrieval failed
     */
    onGiftsRetrieveFailed : function(errorMessage) {},
    /**
     Fired when a gift has began to be sent to the server.
     @param gift the gift that is being sent.
     */
    onGiftSendStarted : function(gift) {},
    /**
     Fired when sending the gift has failed.
     NOTE: At this point the gift will have an ID
     @param gift the gift which was sent
     */
    onGiftSendFinished : function(gift) {},
    /**
     Fired when sending the gift has failed.
     @param gift the gift has failed to be sent.
     @param errorMessage The reason why the gift has failed to be sent.
     */
    onGiftSendFailed : function(gift, errorMessage) {},
    /**
     Fired when the gift was handed out to the user.
     @param gift the gift which was handed out to the user.
     */
    onGiftHandOutSuccess : function(gift) {},
    /**
     Fired when handing out the gift to the user has failed.
     @param gift the gift that failed to be handed out.
     @param errorMessage The reason why the gift has failed to be handed out.
     */
    onGiftHandOutFailed : function(gift, errorMessage) {}
  });

  /**
   * Root definitions
   */
  Soomla.eventHandlers = [];

  /**
   * Dispatch event. Goes through event handlers and calls
   * @param eventName function to call in event handlers
   * @param {...Mixed} params params to pass to the function of event handlers
   */
  Soomla.dispatchEvent = function (eventName) {
    // TODO: Switch all dispatching to this function
    if (arguments.length === 0) {
      console.log('dispatchEvent: Wrong arguments number');
      return;
    }
    var functionName = _.take(arguments);
    _.forEach(Soomla.eventHandlers, function (eventHandler) {
      if (_.isFunction(eventHandler[functionName])) {
        eventHandler[functionName].apply(eventHandler, arguments);
      }
    });
  };

  Soomla.addEventHandler = Soomla.on = function (eventHandler) {
    Soomla.eventHandlers.push(eventHandler);
  };
  Soomla.removeEventHandler = Soomla.off = function (eventHandler) {
    var idx = Soomla.eventHandlers.indexOf(eventHandler);
    Soomla.eventHandlers.splice(idx, 1);
  };
  Soomla.ndkCallback = function (parameters) {
    parameters = JSON.parse(parameters);
    try {
      var methodName = parameters.method || "";

      // ------- Core -------- //
      if (methodName == "com.soomla.events.RewardGivenEvent") {
        var rewardId = parameters['reward'];
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onRewardGivenEvent) {
            var result = Soomla.Models.Reward.getReward(rewardId);
            eventHandler.onRewardGivenEvent(result);
          }
        });
      }
      else if (methodName == "com.soomla.events.RewardTakenEvent") {
        var rewardId = parameters['reward'];
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onRewardTakenEvent) {
            var result = Soomla.Models.Reward.getReward(rewardId);
            eventHandler.onRewardTakenEvent(result);
          }
        });
      }
      else if (methodName == "com.soomla.events.CustomEvent") {
        var name = parameters['name'];
        var extra = parameters['extra'];
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onCustomEvent) {
            eventHandler.onCustomEvent(name, extra);
          }
        });
      }

      // ------- Store -------- //
      else if (methodName == "CCStoreEventHandler::onBillingNotSupported") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onBillingNotSupported) {
            eventHandler.onBillingNotSupported();
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onBillingSupported") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onBillingSupported) {
            eventHandler.onBillingSupported();
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onCurrencyBalanceChanged") {
        var virtualCurrency = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onCurrencyBalanceChanged) {
            eventHandler.onCurrencyBalanceChanged(virtualCurrency, parameters.balance, parameters.amountAdded);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onGoodBalanceChanged") {
        var virtualGood = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGoodBalanceChanged) {
            eventHandler.onGoodBalanceChanged(virtualGood, parameters.balance, parameters.amountAdded);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onGoodEquipped") {
        var equippableVG = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGoodEquipped) {
            eventHandler.onGoodEquipped(equippableVG);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onGoodUnEquipped") {
        var equippableVG = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGoodUnEquipped) {
            eventHandler.onGoodUnEquipped(equippableVG);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onGoodUpgrade") {
        var virtualGood = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        var upgradeVG = Soomla.storeInfo.getItemByItemId(parameters.vguItemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGoodUpgrade) {
            eventHandler.onGoodUpgrade(virtualGood, upgradeVG);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onItemPurchased") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onItemPurchased) {
            eventHandler.onItemPurchased(purchasableVirtualItem);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onItemPurchaseStarted") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onItemPurchaseStarted) {
            eventHandler.onItemPurchaseStarted(purchasableVirtualItem);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketPurchaseCancelled") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketPurchaseCancelled) {
            eventHandler.onMarketPurchaseCancelled(purchasableVirtualItem);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketPurchase") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        var token = parameters.token;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketPurchase) {
            eventHandler.onMarketPurchase(purchasableVirtualItem, token, payload);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketPurchaseStarted") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketPurchaseStarted) {
            eventHandler.onMarketPurchaseStarted(purchasableVirtualItem);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketItemsRefreshed") {
        var marketItemsDict = parameters.marketItems;
        var marketItems = [];
        _.forEach(marketItemsDict, function(marketItem) {

          // be careful confusing naming: snake_case VS camelCase
          var productId = marketItem.productId;
          var marketPrice = marketItem.marketPrice;
          var marketTitle = marketItem.marketTitle;
          var marketDescription = marketItem.marketDesc;

          var pvi = Soomla.storeInfo.getPurchasableItemWithProductId(productId);

          var purchaseWithMarket = pvi.purchasableItem;
          var mi = purchaseWithMarket.marketItem;

          mi.marketPrice        = marketPrice;
          mi.marketTitle        = marketTitle;
          mi.marketDescription  = marketDescription;

          marketItems.push(pvi);
        });

        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketItemsRefreshed) {
            eventHandler.onMarketItemsRefreshed(marketItems);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketItemsRefreshStarted") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketItemsRefreshStarted) {
            eventHandler.onMarketItemsRefreshStarted();
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketItemsRefreshFailed") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketItemsRefreshFailed) {
            eventHandler.onMarketItemsRefreshFailed(parameters.errorMessage);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onMarketPurchaseVerification") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketPurchaseVerification) {
            eventHandler.onMarketPurchaseVerification(purchasableVirtualItem);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onRestoreTransactionsFinished") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onRestoreTransactionsFinished) {
            eventHandler.onRestoreTransactionsFinished(parameters.success);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onRestoreTransactionsStarted") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onRestoreTransactionsStarted) {
            eventHandler.onRestoreTransactionsStarted();
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onUnexpectedErrorInStore") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onUnexpectedErrorInStore) {
            eventHandler.onUnexpectedErrorInStore();
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onSoomlaStoreInitialized") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onSoomlaStoreInitialized) {
            eventHandler.onSoomlaStoreInitialized();
          }
        });
      }
      //  Android specific
      else if (methodName == "CCStoreEventHandler::onMarketRefund") {
        var purchasableVirtualItem = Soomla.storeInfo.getItemByItemId(parameters.itemId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMarketRefund) {
            eventHandler.onMarketRefund(purchasableVirtualItem);
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onIabServiceStarted") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onIabServiceStarted) {
            eventHandler.onIabServiceStarted();
          }
        });
      }
      else if (methodName == "CCStoreEventHandler::onIabServiceStopped") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onIabServiceStopped) {
            eventHandler.onIabServiceStopped();
          }
        });
      }

      // Profile
      else if (methodName == "com.soomla.profile.events.ProfileInitializedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onProfileInitialized) {
            eventHandler.onProfileInitialized();
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.UserRatingEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onUserRatingEvent) {
            eventHandler.onUserRatingEvent();
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LoginCancelledEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLoginCancelledEvent) {
            eventHandler.onLoginCancelledEvent(provider, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LoginFailedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var errorDescription = parameters.errorDescription;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLoginFailed) {
            eventHandler.onLoginFailed(provider, errorDescription, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LoginFinishedEvent") {
        var userProfile = parameters.userProfile;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLoginFinished) {
            eventHandler.onLoginFinished(userProfile, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LoginStartedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var payload = parameters.payload;

        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLoginStarted) {
            eventHandler.onLoginStarted(provider, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LogoutFailedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var errorDescription = parameters.errorDescription;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLogoutFailed) {
            eventHandler.onLogoutFailed(provider, errorDescription);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LogoutFinishedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLogoutFinished) {
            eventHandler.onLogoutFinished(provider);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.auth.LogoutStartedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onLogoutStarted) {
            eventHandler.onLogoutStarted(provider);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.GetContactsFailedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var errorDescription = parameters.errorDescription;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGetContactsFailed) {
            eventHandler.onGetContactsFailed(provider, errorDescription, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.GetContactsFinishedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var contacts = parameters.contacts;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGetContactsFinished) {
            eventHandler.onGetContactsFinished(provider, errorDescription, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.GetContactsStartedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGetContactsStarted) {
            eventHandler.onGetContactsStarted(provider, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.GetFeedFailedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var errorDescription = parameters.errorDescription;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGetFeedFailed) {
            eventHandler.onGetFeedFailed(provider, errorDescription, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.GetFeedFinishedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var feed = parameters.feed;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGetFeedFinished) {
            eventHandler.onGetFeedFinished(provider, feed, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.GetFeedStartedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGetFeedStarted) {
            eventHandler.onGetFeedStarted(provider, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.SocialActionFailedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var socialActionType = parameters.socialActionType;
        var errorDescription = parameters.errorDescription;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onSocialActionFailedEvent) {
            eventHandler.onSocialActionFailedEvent(provider, socialActionType, errorDescription, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.SocialActionFinishedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var socialActionType = parameters.socialActionType;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onSocialActionFinishedEvent) {
            eventHandler.onSocialActionFinishedEvent(provider, socialActionType, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.social.SocialActionStartedEvent") {
        var providerId = parameters.provider;
        var provider = Provider.findById(providerId);
        var socialActionType = parameters.socialActionType;
        var payload = parameters.payload;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onSocialActionStartedEvent) {
            eventHandler.onSocialActionStartedEvent(provider, socialActionType, payload);
          }
        });
      }
      else if (methodName == "com.soomla.profile.events.UserProfileUpdatedEvent") {
        var userProfile = parameters.userProfile;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onUserProfileUpdatedEvent) {
            eventHandler.onUserProfileUpdatedEvent(userProfile);
          }
        });
      }

      else if (methodName == "Reflection::CCStoreInfo::initializeFromDB") {
        Soomla.dispatchEvent('initializeFromDB');
      }

      else if (methodName == "CCHighwayEventDispatcher::onStateConflict") {
        var remoteState = parameters.remoteState;
        var currentState = parameters.currentState;
        var stateDiff = parameters.stateDiff;

        if (Soomla.soomlaSync.resolveStateConflict) {
          Soomla.soomlaSync.resolveStateConflict(remoteState, currentState, stateDiff);
        }
      }
      else if (methodName == "com.soomla.sync.events.SoomlaSyncInitializedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onSoomlaSyncInitialized) {
            eventHandler.onSoomlaSyncInitialized();
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.MetaDataSyncStartedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMetaDataSyncStarted) {
            eventHandler.onMetaDataSyncStarted();
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.MetaDataSyncFinishedEvent") {
        var changedComponents = parameters.changedComponents;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMetaDataSyncFinished) {
            eventHandler.onMetaDataSyncFinished(changedComponents);
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.MetaDataSyncFailedEvent") {
        var errorCode = parameters.errorCode;
        var errorMessage = parameters.errorMessage;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onMetaDataSyncFailed) {
            eventHandler.onMetaDataSyncFailed(errorCode, errorMessage);
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.StateSyncStartedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onStateResetStarted) {
            eventHandler.onStateSyncStarted();
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.StateSyncFinishedEvent") {
        var changedComponents = parameters.changedComponents;
        var failedComponents = parameters.failedComponents;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onStateSyncFinished) {
            eventHandler.onStateSyncFinished(changedComponents, failedComponents);
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.StateSyncFailedEvent") {
        var errorCode = parameters.errorCode;
        var errorMessage = parameters.errorMessage;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onStateSyncFailed) {
            eventHandler.onStateSyncFailed(errorCode, errorMessage);
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.StateResetStartedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onStateResetStarted) {
            eventHandler.onStateResetStarted();
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.StateResetFinishedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onStateResetFinished) {
            eventHandler.onStateResetFinished();
          }
        });
      }
      else if (methodName == "com.soomla.sync.events.StateResetFailedEvent") {
        var errorCode = parameters.errorCode;
        var errorMessage = parameters.errorMessage;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onStateResetFailed) {
            eventHandler.onStateResetFailed(errorCode, errorMessage);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.SoomlaGiftingInitializedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onSoomlaGiftingInitialized) {
            eventHandler.onSoomlaGiftingInitialized();
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftsRetrieveStartedEvent") {
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftsRetrieveStarted) {
            eventHandler.onGiftsRetrieveStarted();
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftsRetrieveFinishedEvent") {
        var givenGifts = parameters.givenGifts;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftsRetrieveFinished) {
            eventHandler.onGiftsRetrieveFinished(givenGifts);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftsRetrieveFailedEvent") {
        var errorMessage = parameters.errorMessage;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftsRetrieveFailed) {
            eventHandler.onGiftsRetrieveFailed(errorMessage);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftSendStartedEvent") {
        var gift = parameters.gift;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftSendStarted) {
            eventHandler.onGiftSendStarted(gift);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftSendFinishedEvent") {
        var gift = parameters.gift;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftSendFinished) {
            eventHandler.onGiftSendFinished(gift);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftSendFailedEvent") {
        var gift = parameters.gift;
        var errorMessage = parameters.errorMessage;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftSendFailed) {
            eventHandler.onGiftSendFailed(gift, errorMessage);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftHandOutSuccessEvent") {
        var gift = parameters.gift;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftHandOutSuccess) {
            eventHandler.onGiftHandOutSuccess(gift);
          }
        });
      }
      else if (methodName == "com.soomla.gifting.events.GiftHandOutFailedEvent") {
        var gift = parameters.gift;
        var errorMessage = parameters.errorMessage;
        _.forEach(Soomla.eventHandlers, function (eventHandler) {
          if (eventHandler.onGiftHandOutFailed) {
            eventHandler.onGiftHandOutFailed(gift, errorMessage);
          }
        });
      }
    } catch (e) {
      logError("ndkCallback: " + e.message);
    }
  };
  // put it into global context
  ndkCallback = function(params) {
    Soomla.ndkCallback.call(Soomla, params);
  };

  var StoreBridge = Soomla.StoreBridge = declareClass("StoreBridge", {
    init: function () {
      return true;
    },
    applyParams: function applyParams(storeParams) {
    }
  });

  var NativeStoreBridge = Soomla.NativeStoreBridge = declareClass("NativeStoreBridge", {
    init: function () {
      this.bindNative();
      return true;
    },
    applyParams: function applyParams(storeParams) {
      if (platform.isIos()) {
        callNative({
          method: "CCSoomlaStore::setSSV",
          ssv: storeParams.SSV
        });
      }

      if (platform.isAndroid()) {
        callNative({
          method: "CCSoomlaStore::setAndroidPublicKey",
          androidPublicKey: storeParams.androidPublicKey
        });
        callNative({
          method: "CCSoomlaStore::setTestPurchases",
          testPurchases: storeParams.testPurchases
        });
      }
    },

    bindNative: function bindNative() {
      logDebug('Binding to native platform Store bridge...');

      if (platform.isAndroid()) {
        jsb.reflection.callStaticMethod('com/soomla/cocos2dx/store/StoreBridgeBinder', "bind", "()V");
      } else if (platform.isIos()) {
        jsb.reflection.callStaticMethod('StoreBridge', 'initShared');
      } else {
        logError('Unsupported platform: ' + platform.name);
      }
    }
  }, StoreBridge);

  StoreBridge.initShared = function () {
    var ret = platform.isNativeSupported() ? NativeStoreBridge.create() : StoreBridge.create();
    if (ret.init()) {
      Soomla.storeBridge = ret;
    } else {
      Soomla.storeBridge = null;
    }
  };

  /**
   * SoomlaStore
   */
  var SoomlaStore = Soomla.SoomlaStore = declareClass("SoomlaStore", {
    SOOMLA_AND_PUB_KEY_DEFAULT: "YOUR GOOGLE PLAY PUBLIC KEY",
    initialized: false,
    initialize: function(storeAssets, storeParams) {

      if (this.initialized) {
        var err = "SoomlaStore is already initialized. You can't initialize it twice!";
        Soomla.dispatchEvent('onUnexpectedErrorInStore', err, true);
        logError(err);
        return;
      }

      StoreBridge.initShared();

      logDebug("CCSoomlaStore Initializing...");

      this.loadBillingService();

      StoreInfo.createShared(storeAssets);

      Soomla.storeBridge.applyParams(storeParams);

      if (platform.isIos()) {
        this.refreshMarketItemsDetails();
      } else if (platform.isAndroid()) {
        this.refreshInventory();
      }

      this.initialized = true;
      Soomla.dispatchEvent('onSoomlaStoreInitialized', true);

      return true;
    },
    buyMarketItem: function(productId, payload) {
      ////===========
      var item = Soomla.storeInfo.getPurchasableItemWithProductId(productId);
      if (!item) {
        return;
      }

      // simulate onMarketPurchaseStarted event
      Soomla.dispatchEvent('onMarketPurchaseStarted', item);

      // in the editor we just give the item... no real market.
      item.give(1);

      // simulate onMarketPurchase event
      Soomla.dispatchEvent('onMarketPurchase', item, 'fake_token_zyxw9876', payload);
    },
    restoreTransactions: function() {
    },
    refreshInventory: function() {
    },
    refreshMarketItemsDetails: function() {
    },
    // For iOS only
    transactionsAlreadyRestored: function() {
    },
    // For Android only
    startIabServiceInBg: function() {
    },
    // For Android only
    stopIabServiceInBg: function() {
    },

    loadBillingService: function loadBillingService() {

    }
  });

  /**
   * NativeSoomlaStore
   */
  var NativeSoomlaStore = Soomla.NativeSoomlaStore = declareClass("NativeSoomlaStore", {
    buyMarketItem: function(productId, payload) {
      callNative({
        method: "CCSoomlaStore::buyMarketItem",
        productId: productId,
        payload: payload
      });
    },
    restoreTransactions: function() {
      callNative({
        method: "CCSoomlaStore::restoreTransactions"
      });
    },
    refreshInventory: function() {
      callNative({
        method: "CCSoomlaStore::refreshInventory"
      });
    },
    refreshMarketItemsDetails: function() {
      callNative({
        method: "CCSoomlaStore::refreshMarketItemsDetails"
      });
    },
    // For iOS only
    transactionsAlreadyRestored: function() {
      var retParams = callNative({
        method: "CCSoomlaStore::transactionsAlreadyRestored"
      });
      return retParams.return;
    },
    // For Android only
    startIabServiceInBg: function() {
      callNative({
        method: "CCSoomlaStore::startIabServiceInBg"
      });
    },
    // For Android only
    stopIabServiceInBg: function() {
      callNative({
        method: "CCSoomlaStore::stopIabServiceInBg"
      });
    },

    loadBillingService: function() {
      callNative({
        method: "CCSoomlaStore::loadBillingService"
      });
    }
  }, SoomlaStore);

  Soomla.soomlaStore = platform.isNativeSupported() ? NativeSoomlaStore.create() : SoomlaStore.create();

  var StoreInventory = Soomla.StoreInventory = declareClass("StoreInventory", {
    buyItem: function(itemId, payload) {
      callNative({
        method: "CCStoreInventory::buyItem",
        payload: payload,
        itemId: itemId
      });
    },
    getItemBalance: function(itemId) {
      var retParams = callNative({
        method: "CCStoreInventory::getItemBalance",
        itemId: itemId
      });
      return retParams.return;
    },
    giveItem: function(itemId, amount) {
      callNative({
        method: "CCStoreInventory::giveItem",
        itemId: itemId,
        amount: amount
      });
    },
    takeItem: function(itemId, amount) {
      callNative({
        method: "CCStoreInventory::takeItem",
        itemId: itemId,
        amount: amount
      });
    },
    equipVirtualGood: function(itemId) {
      callNative({
        method: "CCStoreInventory::equipVirtualGood",
        itemId: itemId
      });
    },
    unEquipVirtualGood: function(itemId) {
      callNative({
        method: "CCStoreInventory::unEquipVirtualGood",
        itemId: itemId
      });
    },
    isVirtualGoodEquipped: function(itemId) {
      var retParams = callNative({
        method: "CCStoreInventory::isVirtualGoodEquipped",
        itemId: itemId
      });
      return retParams.return;
    },
    getGoodUpgradeLevel: function(goodItemId) {
      var retParams = callNative({
        method: "CCStoreInventory::getGoodUpgradeLevel",
        goodItemId: goodItemId
      });
      return retParams.return;
    },
    getGoodCurrentUpgrade: function(goodItemId) {
      var retParams = callNative({
        method: "CCStoreInventory::getGoodCurrentUpgrade",
        goodItemId: goodItemId
      });
      return retParams.return;
    },
    upgradeGood: function(goodItemId) {
      callNative({
        method: "CCStoreInventory::upgradeGood",
        goodItemId: goodItemId
      });
    },
    removeGoodUpgrades: function(goodItemId) {
      callNative({
        method: "CCStoreInventory::removeGoodUpgrades",
        goodItemId: goodItemId
      });
    }
  });

  Soomla.storeInventory = StoreInventory.create();

  function SoomlaException(code, message) {
    this.name = "SoomlaException";
    this.code = code || 0;
    this.message = (message || "");
  }
  SoomlaException.prototype = Error.prototype;
  SoomlaException.CODE = {
    ITEM_NOT_FOUND: -1,
    INSUFFICIENT_FUNDS: -2,
    NOT_ENOUGH_GOODS: -3,
    OTHER: -4
  };

  /**
   * SoomlaProfile
   */
  var SoomlaProfile = Soomla.SoomlaProfile = declareClass("SoomlaProfile", {
    inited: false,
    init: function(customParams) {
      callNative({
        method: "CCProfileBridge::init",
        params: customParams
      });

      this.inited = true;
      return true;
    },
    login: function(provider, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::login",
        provider: provider.key
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    logout: function(provider) {
      callNative({
        method: "CCSoomlaProfile::logout",
        provider: provider.key
      });
    },
    getStoredUserProfile: function(provider) {
      var retParams = callNative({
        method: "CCSoomlaProfile::getStoredUserProfile",
        provider: provider.key
      });
      return retParams.return;
    },
    updateStatus: function(provider, status, payload, reward) {
      var toPassData = {
        method: "CCSoomlaProfile::updateStatus",
        provider: provider.key,
        status: status
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    updateStatusDialog: function(provider, link, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::updateStatusDialog",
        provider: provider.key,
        link: link
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    updateStory: function(provider, message, name, caption, description, link, picture, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::updateStory",
        provider: provider.key,
        message: message,
        name: name,
        caption: caption,
        description: description,
        link: link,
        picture: picture
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    updateStoryDialog: function(provider, name, caption, description, link, picture, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::updateStoryDialog",
        provider: provider.key,
        name: name,
        caption: caption,
        description: description,
        link: link,
        picture: picture
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    uploadImage: function(provider, message, filePath, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::uploadImage",
        provider: provider.key,
        message: message,
        filePath: filePath
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    getContacts: function(provider, filePath, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::getContacts",
        provider: provider.key,
        reward: reward
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    getFeed: function(provider, reward, payload) {
      var toPassData = {
        method: "CCSoomlaProfile::getFeed",
        provider: provider.key
      };

      if (payload) {
        toPassData.payload = payload;
      }
      else {
        toPassData.payload = "default";
      }

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    isLoggedIn: function(provider) {
      var retParams = callNative({
        method: "CCSoomlaProfile::isLoggedIn",
        provider: provider.key
      });
      return retParams.return;
    },
    like: function(provider, pageName, reward) {
      var toPassData = {
        method: "CCSoomlaProfile::like",
        provider: provider.key,
        pageName: pageName
      };

      if (reward) {
        toPassData.reward = reward;
      }

      callNative(toPassData, true);
    },
    openAppRatingPage: function() {
      callNative({
        method: "CCSoomlaProfile::openAppRatingPage"
      });
    }
  });

  SoomlaProfile.createShared = function(customParams) {
    var ret = new SoomlaProfile();
    if (ret.init(customParams)) {
      Soomla.soomlaProfile = ret;
    } else {
      Soomla.soomlaProfile = null;
    }
  };

  var callNative = function (params, clean) {
    var jsonString = null;

    if (typeof(clean) === "undefined") {
      jsonString = Soomla.CCSoomlaNdkBridge.callNative(JSON.stringify(params));
    }
    else {
      jsonString = Soomla.CCSoomlaNdkBridge.callNative(JSON.stringify(params, removeNulls));
    }

    var result = JSON.parse(jsonString);

    if (!result.success) {
      throw new SoomlaException(result.code, result.info);
    }
    return result.result;
  };

  var removeNulls = function(key, value) {
    if (!value){
      return undefined;
    }

    return value;
  };

  var logDebug = Soomla.logDebug = function (output) {
    if (Soomla.DEBUG) {
      console.log("DEBUG: " + output);
    }
  };

  var logError = Soomla.logError = function (output) {
    console.log("ERROR: " + output);
  };

  var dumpError = Soomla.dumpError = function (e) {
    return e + " : " + JSON.stringify(e);
  };

  return Soomla
};