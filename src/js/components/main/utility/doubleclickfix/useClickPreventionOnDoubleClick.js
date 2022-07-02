import useCancellablePromises from "./useCancellablePromises.js";
import { cancellablePromise } from "../../../../utility/utilityFunctions.ts";

const useClickPreventionOnDoubleClick = (onClick, onDoubleClick) => {
  const delay = (n) => new Promise((resolve) => setTimeout(resolve, n));
  const noop = () => {};
  const api = useCancellablePromises();

  const handleClick = () => {
    api.clearPendingPromises();
    const waitForClick = cancellablePromise(delay(125)); //controls delay between double click detect
    api.appendPendingPromise(waitForClick);

    return waitForClick.promise
      .then(() => {
        api.removePendingPromise(waitForClick);
        onClick();
      })
      .catch((errorInfo) => {
        api.removePendingPromise(waitForClick);
        if (!errorInfo.isCanceled) {
          throw errorInfo.error;
        }
      });
  };

  const handleDoubleClick = () => {
    api.clearPendingPromises();
    onDoubleClick();
  };

  return [handleClick, handleDoubleClick];
};

export default useClickPreventionOnDoubleClick;
