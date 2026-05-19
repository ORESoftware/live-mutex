'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const async = require("async");
const _suman = global.__suman = (global.__suman || {});
const general_1 = require("../helpers/general");
exports.makeNotifyParent = function (suman, gracefulExit, handleBeforesAndAfters) {
    return function notifyParentThatChildIsComplete(child, cb) {
        const parent = child.parent;
        if (!parent) {
            return process.nextTick(cb);
        }
        if (!child.allChildBlocksCompleted && child.getChildren().length > 0) {
            return process.nextTick(cb);
        }
        if (!parent.completedChildrenMap.get(child)) {
            parent.completedChildrenMap.set(child, true);
            parent.childCompletionCount++;
        }
        if (parent.childCompletionCount === parent.getChildren().length) {
            parent.allChildBlocksCompleted = true;
        }
        if (parent.childCompletionCount > parent.getChildren().length) {
            parent.allChildBlocksCompleted = true;
            _suman.log.warning('Suman implementation warning => parent.childCompletionCount should never be greater than ' +
                'parent.getChildren().length');
        }
        if (!parent.allChildBlocksCompleted) {
            return process.nextTick(cb);
        }
        if (parent.alreadyStartedAfterHooks) {
            return process.nextTick(cb);
        }
        parent.afterHooksCallback = function (cb) {
            parent.alreadyStartedAfterHooks = true;
            async.eachSeries(parent.getAfters(), function (aBeforeOrAfter, cb) {
                handleBeforesAndAfters(child, aBeforeOrAfter, cb);
            }, function complete(err) {
                general_1.implementationError(err);
                process.nextTick(function () {
                    notifyParentThatChildIsComplete(parent, cb);
                });
            });
        };
        if (parent.couldNotRunAfterHooksFirstPass) {
            parent.afterHooksCallback(cb);
        }
        else {
            process.nextTick(cb);
        }
    };
};
