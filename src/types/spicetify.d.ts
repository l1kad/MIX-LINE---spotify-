// Minimal Spicetify type declarations for MyWave extension

declare namespace Spicetify {
  const React: typeof import("react");
  const ReactDOM: {
    render(element: any, container: Element | null): void;
    unmountComponentAtNode(container: Element): boolean;
  };

  function showNotification(text: string, isError?: boolean): void;

  function addToQueue(items: Array<{ uri: string }>): Promise<void>;

  namespace Player {
    const data: {
      item?: {
        uri: string;
        metadata?: {
          title?: string;
          artist_name?: string;
          album_title?: string;
          image_url?: string;
        };
      };
    } | null;

    function addEventListener(event: string, callback: (...args: any[]) => void): void;
    function removeEventListener(event: string, callback: (...args: any[]) => void): void;
    function next(): void;
    function back(): void;
    function togglePlay(): void;
  }

  namespace CosmosAsync {
    function get(url: string, body?: any): Promise<any>;
    function post(url: string, body?: any): Promise<any>;
  }

  namespace Platform {
    namespace Session {
      const accessToken: string;
    }
  }

  namespace ContextMenu {
    class Item {
      constructor(name: string, onClick: (uris: string[]) => void, shouldAdd?: (uris: string[]) => boolean);
      register(): void;
      deregister(): void;
    }
  }
}
