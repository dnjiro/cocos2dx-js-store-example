//
// Created by Fedor Shubin on 5/24/13.
//


#ifndef __MuffinRushAssets_H_
#define __MuffinRushAssets_H_

#include "CCIStoreAssets.h"
#include "cocos2d.h"

class MuffinRushAssets: public soomla::CCIStoreAssets {
    cocos2d::CCArray *mCurrencies;
    cocos2d::CCArray *mGoods;
    cocos2d::CCArray *mCurrencyPacks;
    cocos2d::CCArray *mCategories;
    cocos2d::CCArray *mNonConsumableItems;
public:
    MuffinRushAssets():
    mCurrencies(NULL),
    mGoods(NULL),
    mCurrencyPacks(NULL),
    mCategories(NULL),
    mNonConsumableItems(NULL)
    {}

    virtual ~MuffinRushAssets();

    static MuffinRushAssets *create();
    bool init();

    virtual int getVersion();

    virtual cocos2d::CCArray *getCurrencies();

    virtual cocos2d::CCArray *getGoods();

    virtual cocos2d::CCArray *getCurrencyPacks();

    virtual cocos2d::CCArray *getCategories();

    virtual cocos2d::CCArray *getNonConsumableItems();
};


#endif //__MuffinRushAssets_H_
