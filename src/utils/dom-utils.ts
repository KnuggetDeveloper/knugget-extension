/**
 * Knugget AI DOM utilities
 * Enhanced version with improved error handling and performance
 */

/**
 * Creates an element with specified attributes and children
 * @param tag HTML element tag name
 * @param attributes Object containing element attributes
 * @param children Array of child elements or strings
 * @returns The created HTML element
 */
export function createElement<T extends HTMLElement>(
  tag: string,
  attributes: Record<string, string | EventListener> = {},
  children: (HTMLElement | string)[] = []
): T {
  const element = document.createElement(tag) as T;

  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === "className") {
      element.className = value as string;
    } else if (key === "innerHTML") {
      element.innerHTML = value as string;
    } else if (key.startsWith("on") && typeof value === "function") {
      // Handle event listeners
      element.addEventListener(key.substring(2).toLowerCase(), value as EventListener);
    } else {
      element.setAttribute(key, value as string);
    }
  });

  // Append children
  children.forEach((child) => {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Find an element with retries and exponential backoff
 * Useful for finding elements that might not be immediately available in the DOM
 * @param selector CSS selector for the element
 * @param maxRetries Maximum number of retries (default: 10)
 * @param initialIntervalMs Initial interval between retries in milliseconds (default: 100)
 * @returns Promise resolving to the found element or null if not found
 */
export function findElementWithRetry(
  selector: string,
  maxRetries: number = 10,
  initialIntervalMs: number = 100
): Promise<Element | null> {
  return new Promise((resolve) => {
    let retries = 0;
    let intervalMs = initialIntervalMs;

    const findElement = () => {
      const element = document.querySelector(selector);

      if (element) {
        resolve(element);
        return;
      }

      retries++;

      if (retries >= maxRetries) {
        console.warn(`Element not found after ${maxRetries} attempts: ${selector}`);
        resolve(null);
        return;
      }

      // Use exponential backoff for more efficient retries
      intervalMs = Math.min(initialIntervalMs * Math.pow(1.5, retries), 2000);
      setTimeout(findElement, intervalMs);
    };

    findElement();
  });
}

/**
 * Create and mount a MutationObserver to watch for DOM changes
 * @param targetNode Node to observe
 * @param config MutationObserver configuration
 * @param callback Callback to be executed on DOM changes
 * @returns The created MutationObserver instance
 */
export function createObserver(
  targetNode: Node,
  config: MutationObserverInit,
  callback: (mutations: MutationRecord[], observer: MutationObserver) => void
): MutationObserver {
  try {
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
    return observer;
  } catch (error) {
    console.error("Error creating observer:", error);
    // Return a dummy observer that does nothing when methods are called
    return {
      observe: () => {},
      disconnect: () => {},
      takeRecords: () => []
    } as MutationObserver;
  }
}

/**
 * Wait for an element to appear in the DOM
 * @param selector CSS selector for the element
 * @param timeoutMs Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to the found element or null if timeout
 */
export function waitForElement(
  selector: string,
  timeoutMs: number = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    // Set timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      console.warn(`Timeout waiting for element: ${selector}`);
      resolve(null);
    }, timeoutMs);

    // Create observer
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  });
}

/**
 * Safely insert element after another element
 * @param newElement Element to insert
 * @param targetElement Element after which to insert
 * @returns Boolean indicating success
 */
export function insertAfter(
  newElement: HTMLElement,
  targetElement: HTMLElement
): boolean {
  try {
    if (!targetElement || !targetElement.parentNode) {
      return false;
    }
    
    targetElement.parentNode.insertBefore(newElement, targetElement.nextSibling);
    return true;
  } catch (error) {
    console.error("Error inserting element:", error);
    return false;
  }
}

/**
 * Safely insert element as first child
 * @param newElement Element to insert
 * @param parentElement Parent element to insert into
 * @returns Boolean indicating success
 */
export function insertAsFirstChild(
  newElement: HTMLElement,
  parentElement: HTMLElement
): boolean {
  try {
    if (!parentElement) {
      return false;
    }
    
    if (parentElement.firstChild) {
      parentElement.insertBefore(newElement, parentElement.firstChild);
    } else {
      parentElement.appendChild(newElement);
    }
    return true;
  } catch (error) {
    console.error("Error inserting element as first child:", error);
    return false;
  }
}

/**
 * Remove all children from an element
 * @param element Element to clear
 */
export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Add event listener with automatic cleanup
 * @param element Element to attach event to
 * @param eventType Event type (e.g., 'click')
 * @param handler Event handler function
 * @param options Event listener options
 * @returns Function to remove the event listener
 */
export function addEventListenerWithCleanup(
  element: HTMLElement | Document | Window,
  eventType: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): () => void {
  element.addEventListener(eventType, handler, options);
  
  // Return a cleanup function
  return () => {
    element.removeEventListener(eventType, handler, options);
  };
}

/**
 * Safely add styles to document
 * @param cssText CSS text to add
 * @param id Optional ID for the style element
 * @returns The created style element or null if failed
 */
export function addStyles(cssText: string, id?: string): HTMLStyleElement | null {
  try {
    // Check if style with this ID already exists
    if (id && document.getElementById(id)) {
      const existingStyle = document.getElementById(id) as HTMLStyleElement;
      existingStyle.textContent = cssText;
      return existingStyle;
    }
    
    const style = document.createElement('style');
    style.textContent = cssText;
    
    if (id) {
      style.id = id;
    }
    
    document.head.appendChild(style);
    return style;
  } catch (error) {
    console.error("Error adding styles:", error);
    return null;
  }
}

/**
 * Check if an element is visible in viewport
 * @param element Element to check
 * @returns True if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view if not already visible
 * @param element Element to scroll to
 * @param behavior Scroll behavior (default: 'smooth')
 */
export function scrollIntoViewIfNeeded(
  element: HTMLElement,
  behavior: ScrollBehavior = "smooth"
): void {
  if (!isInViewport(element)) {
    element.scrollIntoView({ behavior, block: "nearest" });
  }
}

/**
 * Safely parse JSON with error handling
 * @param jsonString JSON string to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed object or fallback value
 */
export function safeJSONParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
}

/**
 * Create a debounced function
 * @param func Function to debounce
 * @param waitMs Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      func.apply(context, args);
    }, waitMs);
  };
}

/**
 * Create a throttled function
 * @param func Function to throttle
 * @param limitMs Limit time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastFunc: number;
  let lastRan: number;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = window.setTimeout(() => {
        if ((Date.now() - lastRan) >= limitMs) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limitMs - (Date.now() - lastRan));
    }
  };
}

/**
 * Measure DOM operation performance
 * @param operationName Name of the operation
 * @param operation Function to measure
 * @returns Result of the operation
 */
export function measurePerformance<T>(
  operationName: string,
  operation: () => T
): T {
  const start = performance.now();
  const result = operation();
  const end = performance.now();
  
  console.debug(`[Performance] ${operationName}: ${Math.round(end - start)}ms`);
  return result;
}