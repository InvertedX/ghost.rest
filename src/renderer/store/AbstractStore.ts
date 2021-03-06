interface IDict<T> {
  [K:string]:T;
}

//
// These stores expose two public interfaces, one of which is
// callable directly by local Typescript code, the other of which
// is callable over ipc. Depending on whether this store is running
// in the renderer, a webview, or a conventional web page the other
// end of that ipc interface is the main process, renderer, or non-existent,
// respectively. In the case of the renderer, the store also accepts
// a hosted WebView containing a matching store and attempts to connect
// the two stores so the renderer store can relay updates from the
// WebView to the main process (because the WebView is not allowed to talk
// directly to the main process for security reasons).
//

//
// This store is configured to either talk to the Electron main process via ipcRenderer
// (when loaded in Electron) or to talk to the Electron host renderer via ipcRendererStub
// (when loaded as a hybrid web page in an Electron WebView) or to run locally as a
// conventional browser web page if no main or host renderer is available. See the
// definition of ipcRendererStub in preload.js for more info on the specific set of
// whitelisted paths and functions supported by ipcRendererStub.
//

//
// NOTE: By convention, this framework uses a convention where WebViews (aka Hybrid Apps)
//       are only allowed to register routes starting with "w2r-" (web->renderer)
//       as a way of making sure that the electron renderer is explicitly whitelisting
//       any messages it exchanges with the WebView before relaying information
//       to this backend process via "r2m" (render->main) routes. This is to block
//       the page running inside the WebView from sending messages directly to the
//       backend process without their being reviewed and approved for relay by the
//       electron render. In support of this convention, the backend should never
//       register any routes starting with "w2r-". Processes reply along the same channels
//       but with "-reply" added to the channel name (so the webview sends a w2r-foo message
//       to the renderer and the renderer replies to the webview with a w2r-foo-reply message).
//

const ipcRenderer = (window as any).isInElectronRenderer
  ? (window as any).nodeRequire("electron").ipcRenderer
  : (window as any).ipcRendererStub;

//
// NOTE: This uses a class static register var to make sure the ipc route names are unique
//       (it's too easy to copy-and-paste some code, forget to update the route name,
//       and end up with two competing functions mapped to the same string).
//

const ipcMainRegistered:IDict<boolean> = {};

abstract class AbstractStore {
  protected mDisposers = [] as Array<() => void>;
  protected isInElectronRenderer = (window as any).isInElectronRenderer;
  protected hasElectronAccess =
    ipcRenderer !== null && ipcRenderer !== undefined;

  public onR2mReply = (
    ipc:string,
    handler:((ipc:string, event:Event, arg:any) => void),
  ) => {
    if (ipc.indexOf("R2M-") !== 0) {
      throw new Error("invalid channel name for <" + ipc + ">");
    }
    if (ipc.substr(-"-REPLY".length) === "-REPLY") {
      throw new Error("invalid channel name for <" + ipc + ">");
    }
    ipcRenderer.on(ipc + "-REPLY", (event:Event, arg:any) => {
      handler(ipc, event, arg);
    });
  }
  public onM2R = (
    ipc:string,
    handler:((ipc:string, event:Event, arg:any) => void),
  ) => {
    if (ipc.indexOf("M2R-") !== 0) {
      throw new Error("invalid channel name for <" + ipc + ">");
    }
    ipcMainRegistered[ipc] = true;
    ipcRenderer.on(ipc, (event:Event, arg:any) => {
      handler(ipc, event, arg);
    });
  }

  public sendR2m = (ipc:string, data:any) => {
    if (this.isInElectronRenderer === false) {
      throw new Error("invalid channel sende for <" + ipc + ">r");
    }
    if (ipc.indexOf("R2M-") !== 0) {
      throw new Error("invalid channel name for <" + ipc + ">");
    }
    if (ipc.substr(-"-reply".length) === "-reply") {
      throw new Error("invalid channel name for <" + ipc + ">");
    }
    ipcRenderer.send(ipc, data);
  }
}

export { AbstractStore };
