//Heavily inspired by http://www.backalleycoder.com/2013/03/18/cross-browser-event-based-element-resize-detection/

"use strict";

var forEach = require("./collection-utils").forEach;
var elementUtilsMaker = require("./element-utils");
var listenerHandlerMaker = require("./listener-handler");
var idGeneratorMaker = require("./id-generator");
var idHandlerMaker = require("./id-handler");

/**
 * @typedef idHandler
 * @type {object}
 * @property {function} get Gets the resize detector id of the element.
 * @property {function} set Generate and sets the resize detector id of the element.
 */

/**
 * @typedef Options
 * @type {object}
 * @property {boolean}      callOnAdd Determines if listeners should be called when they are getting added. 
                            Default is true. If true, the listener is guaranteed to be called when it has been added. 
                            If false, the listener will not be guarenteed to be called when it has been added (does not prevent it from being called).
 * @property {idHandler}    A custom id handler that is responsible for generating, setting and retrieving id's for elements.
                            If not provided, a default id handler will be used.
 */

/**
 * Creates an element resize detector instance.
 * @public
 * @param {Options?} options Optional global options object that will decide how this instance will work.
 */
module.exports = function(options) {
    options = options || {};

    //Options to be used as default for the listenTo function.
    var globalOptions = {};
    globalOptions.callOnAdd = !!getOption(options, "callOnAdd", true);

    //idHandler is currently not an option to the listenTo function, so it should not be added to globalOptions.
    var idHandler = options.idHandler;

    if(!idHandler) {
        var idGenerator = idGeneratorMaker();
        var defaultIdHandler = idHandlerMaker(idGenerator);
        idHandler = defaultIdHandler;
    }

    var eventListenerHandler = listenerHandlerMaker(idHandler);
    var elementUtils = elementUtilsMaker(idHandler);

    /**
     * Makes the given elements resize-detectable and starts listening to resize events on the elements. Calls the event callback for each event for each element.
     * @public
     * @param {Options?} options Optional options object. These options will override the global options. Some options may not be overriden, such as idHandler.
     * @param {element[]|element} elements The given array of elements to detect resize events of. Single element is also valid.
     * @param {function} listener The callback to be executed for each resize event for each element.
     */
    function listenTo(options, elements, listener) {
        function onResizeCallback(element) {
            var listeners = eventListenerHandler.get(element);

            forEach(listeners, function(listener) {
                listener(element);
            });
        }

        function onElementReadyToAddListener(callOnAdd, element, listener) {
            eventListenerHandler.add(element, listener);
            
            if(callOnAdd) {
                listener(element);
            }
        }

        //Options object may be omitted.
        if(!listener) {
            listener = elements;
            elements = options;
            options = {};
        }

        if(!elements) {
            throw new Error("At least one element required.");
        }

        if(!listener) {
            throw new Error("Listener required.");
        }

        if(elements.length === undefined) {
            elements = [elements];
        }

        var callOnAdd = getOption(options, "callOnAdd", globalOptions.callOnAdd);

        forEach(elements, function(element) {
            //The element may change size directly after the call to listenTo, which would be unable to detect it because
            //the async adding of the object. By checking the size before and after, the size change can still be detected
            //and the listener can be called accordingly.
            var preWidth = element.offsetWidth;
            var preHeight = element.offsetHeight;

            if(!elementUtils.isDetectable(element)) {
                //The element is not prepared to be detectable, so do prepare it and add a listener to it.
                return elementUtils.makeDetectable(element, function(element) {
                    elementUtils.addListener(element, onResizeCallback);
                    onElementReadyToAddListener(callOnAdd, element, listener);

                    //Only here the uncaught resize may occur (since this code is async).
                    //Check if the size is the same as when adding the listener.
                    var postWidth = element.offsetWidth;
                    var postHeight = element.offsetHeight;

                    //If callOnAdd is true, then the listener will have been called either way, so no need to call the listener manually then.
                    if(!callOnAdd && (preWidth !== postWidth || preHeight !== postHeight)) {
                        //The element was changed while the object was being added. Call the listener.
                        listener(element);
                    }
                });
            }
            
            //The element has been prepared to be detectable and is ready to be listened to.
            onElementReadyToAddListener(callOnAdd, element, listener);
        });
    }

    return {
        listenTo: listenTo
    };
};

function getOption(options, name, defaultValue) {
    var value = options[name];

    if((value === undefined || value === null) && defaultValue !== undefined) {
        return defaultValue;
    }

    return value;
}
