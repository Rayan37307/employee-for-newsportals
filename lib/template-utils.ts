/**
 * Deserializes a JSON string to template
 */
export function deserializeTemplate(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error deserializing template:', error);
    // Return a default template in case of error
    return {
      width: 1200,
      height: 630,
      backgroundColor: '#ffffff',
      elements: []
    };
  }
}

/**
 * Deserializes a JSON string to KonvaTemplate
 */
export function deserializeTemplate(jsonString: string): KonvaTemplate {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error deserializing template:', error);
    // Return a default template in case of error
    return {
      width: 1200,
      height: 630,
      backgroundColor: '#ffffff',
      elements: []
    };
  }
}

/**
 * Validates if the given object is a valid KonvaTemplate
 */
export function isValidTemplate(obj: any): obj is KonvaTemplate {
  return (
    obj &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    Array.isArray(obj.elements) &&
    obj.elements.every(isValidElement)
  );
}

/**
 * Validates if the given object is a valid KonvaElement
 */
function isValidElement(obj: any): boolean {
  return (
    obj &&
    typeof obj.id === 'string' &&
    ['text', 'image', 'rect'].includes(obj.type) &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number'
  );
}

/**
 * Converts a Fabric.js template to Konva template format
 * This is useful for migrating existing templates
 */
export function fabricToKonvaTemplate(fabricJson: any): KonvaTemplate {
  const width = fabricJson.width || 1200;
  const height = fabricJson.height || 630;
  const backgroundColor = fabricJson.backgroundColor || '#ffffff';
  
  const elements: any[] = [];
  
  if (Array.isArray(fabricJson.objects)) {
    fabricJson.objects.forEach((obj: any, index: number) => {
      let element: any;
      
      // Get dynamic field from custom property
      const dynamicField = obj.dynamicField || 'none';
      const fallbackValue = obj.fallbackValue;
      
      if (obj.type?.toLowerCase().includes('text') || obj.type === 'i-text') {
        element = {
          id: `text-${index}-${Date.now()}`,
          type: 'text',
          x: obj.left || 0,
          y: obj.top || 0,
          text: obj.text || '',
          fontSize: obj.fontSize || 16,
          fontFamily: obj.fontFamily || 'Arial',
          fill: obj.fill || '#000000',
          rotation: obj.angle || 0,
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY || 1,
          dynamicField,
          fallbackValue
        };
      } else if (obj.type === 'rect' || obj.type === 'circle') {
        element = {
          id: `rect-${index}-${Date.now()}`,
          type: 'rect',
          x: obj.left || 0,
          y: obj.top || 0,
          width: obj.width || 100,
          height: obj.height || 100,
          fill: obj.fill || '#000000',
          rotation: obj.angle || 0,
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY || 1,
          dynamicField,
          fallbackValue
        };
        
        // If this rectangle is meant for an image, store the source
        if (dynamicField === 'image' && obj._imageSrc) {
          element.src = obj._imageSrc;
        }
      } else if (obj.type === 'image' || obj.type === 'fabric-image') {
        element = {
          id: `image-${index}-${Date.now()}`,
          type: 'rect', // In Konva, we'll represent image placeholders as rectangles with src
          x: obj.left || 0,
          y: obj.top || 0,
          width: obj.width || 100,
          height: obj.height || 100,
          rotation: obj.angle || 0,
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY || 1,
          dynamicField,
          fallbackValue,
          src: obj._imageSrc || obj.src
        };
      }
      
      if (element) {
        elements.push(element);
      }
    });
  }
  
  return {
    width,
    height,
    backgroundColor,
    elements
  };
}

/**
 * Creates a default template for quick start
 */
export function createDefaultTemplate(): KonvaTemplate {
  return {
    width: 1200,
    height: 630,
    backgroundColor: '#ffffff',
    elements: [
      {
        id: 'title-text',
        type: 'text',
        x: 100,
        y: 100,
        text: 'Title',
        fontSize: 48,
        fontFamily: 'Arial',
        fill: '#000000',
        dynamicField: 'title',
        fallbackValue: 'News Title',
        scaleX: 1,
        scaleY: 1
      },
      {
        id: 'date-text',
        type: 'text',
        x: 100,
        y: 200,
        text: 'Date',
        fontSize: 24,
        fontFamily: 'Arial',
        fill: '#666666',
        dynamicField: 'date',
        fallbackValue: 'January 1, 2026',
        scaleX: 1,
        scaleY: 1
      },
      {
        id: 'image-placeholder',
        type: 'rect',
        x: 100,
        y: 300,
        width: 400,
        height: 300,
        fill: '#f0f0f0',
        dynamicField: 'image',
        fallbackValue: '',
        scaleX: 1,
        scaleY: 1
      }
    ]
  };
}