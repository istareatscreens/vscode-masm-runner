import { eventNames } from "process";

//Remove and add scripts for react
export const removeScript = (scriptToremove: string): void => {
  let allsuspects = <HTMLCollectionOf<HTMLScriptElement>>(
    document.getElementsByTagName("script")
  );
  for (let i = allsuspects.length; i >= 0; i--) {
    if (
      allsuspects[i] &&
      allsuspects[i].getAttribute("src") !== null &&
      allsuspects[i].getAttribute("src").indexOf(`${scriptToremove}`) !== -1
    ) {
      allsuspects[i].parentNode.removeChild(allsuspects[i]);
    }
  }
};

export const addScript = (scriptName: string) => {
  const script = <HTMLScriptElement>document.createElement("script");
  script.src = scriptName;
  script.async = true;
  script.type = "text/javascript";
  document.body.appendChild(script);
};

//Handle post messages and rethrow in document as event
export const createMessageListner = () => {
  window.addEventListener("message", handleMessage, true);
};

export function isValidJSON(string: string): boolean {
  try {
    JSON.parse(string);
    return true;
  } catch (e) {
    return false;
  }
}

const handleMessage = (event: MessageEvent) => {
  //prevent acting on boxedwine execution code
  if (event.data != "zero-timeout-message" && event.data != "") {
    //prevent errors thrown for boxedwine events
    try {
      const { eventName, data } = <{ eventName: string; data: any }>(
        (typeof event.data === "string" && isValidJSON(event.data)
          ? JSON.parse(event.data)
          : event.data)
      );

      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail:
            Array.isArray(data?.data ?? {}) ||
            Object.keys(data?.data ?? {}).length
              ? data?.data ?? data
              : null,
        })
      );
    } catch (e) {}
  }
};

//send post messages
export const postMessage = (eventName: string, data: any) => {
  (<HTMLIFrameElement>(
    document.getElementById("boxedwine")
  )).contentWindow.postMessage(
    JSON.stringify({ eventName: eventName, data: data }),
    "/"
  );
};

//Generate UUID
export const generateRandomID = (): string => {
  // From http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

//Wait for event and then time out
//TODO use this with FileSystem operations to enusre proper handling of files
//even when console is not accessible, or error has occured
export const sleepUntil =
  async () =>
  (
    callback: () => any,
    timeoutMs: number,
    resolutionCallback: () => any = () => {},
    rejectionCallback: () => any = () => {},
    delayBetweenChecks: number = 20
  ): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (callback()) resolve(resolutionCallback());
      const timeWas: number = new Date().getTime();
      let wait = setInterval(function () {
        if (callback()) {
          clearInterval(wait);
          resolve(resolutionCallback());
        } else if (new Date().getTime() - timeWas > timeoutMs) {
          // Timeout
          clearInterval(wait);
          reject(rejectionCallback());
        }
      }, delayBetweenChecks);
    });
  };

//Check if two arrays contain the same elements (unordered, no duplicate elements)
export const checkIfEqualArraysNoDuplicateElements = (
  array1: [any],
  array2: [any]
) =>
  array1.length === array2.length &&
  array1.every((val) => array2.includes(val));

//Cancelable promise
export const cancellablePromise = (promise: Promise<any>) => {
  let isCanceled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(
      (value) => (isCanceled ? reject({ isCanceled, value }) : resolve(value)),
      (error) => reject({ isCanceled, error })
    );
  });

  return {
    promise: wrappedPromise,
    cancel: () => (isCanceled = true),
  };
};

//Rename object key
//Source: https://jetrockets.pro/blog/rmvzzosmz9-rename-the-key-name-in-the-javascript-object
export const renameObjectKey = (object: any, key: string, newKey: string) => {
  const clone = (obj: any) => Object.assign({}, obj);
  const clonedObj = clone(object);

  const targetKey = clonedObj[key];

  delete clonedObj[key];

  clonedObj[newKey] = targetKey;

  return clonedObj;
};

export const checkFileExtension = (fileExtension: string, filename: string) => {
  return new RegExp(`${fileExtension}$`).test(filename);
};

export const getFileExtension = (filename: string) => {
  const extension = filename.match(/\.[0-9a-z]+$/i);
  if (extension) {
    return extension[0];
  } else {
    return "";
  }
};
