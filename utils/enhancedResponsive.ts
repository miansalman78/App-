import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Device type detection - Enhanced for all devices
export const getDeviceType = () => {
  const aspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
  const isLandscape = SCREEN_WIDTH > SCREEN_HEIGHT;
  const isPortrait = SCREEN_HEIGHT > SCREEN_WIDTH;
  
  // Base device type detection
  const isTablet = SCREEN_WIDTH >= 768 || SCREEN_HEIGHT >= 1024;
  const isPhone = !isTablet && (SCREEN_WIDTH < 768 || SCREEN_HEIGHT < 1024);
  
  // Surface Duo detection: Enhanced with range-based detection for better compatibility
  // Surface Duo variants:
  // - Folded portrait: ~360x2700
  // - Folded landscape: ~540x2700  
  // - Unfolded: ~1800x2700
  // Using ranges for better device detection across different Android versions
  const isSurfaceDuo = Platform.OS === 'android' && (
    // Folded state detection (tolerance for different Android versions)
    (SCREEN_WIDTH >= 340 && SCREEN_WIDTH <= 560 && SCREEN_HEIGHT >= 2600 && SCREEN_HEIGHT <= 2800) ||
    (SCREEN_HEIGHT >= 340 && SCREEN_HEIGHT <= 560 && SCREEN_WIDTH >= 2600 && SCREEN_WIDTH <= 2800) ||
    // Unfolded state detection
    (SCREEN_WIDTH >= 1700 && SCREEN_WIDTH <= 1900 && SCREEN_HEIGHT >= 2600 && SCREEN_HEIGHT <= 2800) ||
    (SCREEN_HEIGHT >= 1700 && SCREEN_HEIGHT <= 1900 && SCREEN_WIDTH >= 2600 && SCREEN_WIDTH <= 2800)
  );
  
  // Samsung Galaxy Fold detection (similar aspect ratios)
  // Fold: ~876x2152 (folded), ~1768x2152 (unfolded)
  const isSamsungFold = Platform.OS === 'android' && (
    (SCREEN_WIDTH >= 850 && SCREEN_WIDTH <= 900 && SCREEN_HEIGHT >= 2100 && SCREEN_HEIGHT <= 2200) ||
    (SCREEN_WIDTH >= 1700 && SCREEN_WIDTH <= 1800 && SCREEN_HEIGHT >= 2100 && SCREEN_HEIGHT <= 2200)
  );
  
  // Other foldable devices detection
  const isFoldable = isSurfaceDuo || isSamsungFold;
  
  // Platform-specific device types
  const isSurface = Platform.OS === 'windows' && isTablet;
  const isIPad = Platform.OS === 'ios' && isTablet;
  const isAndroidTablet = Platform.OS === 'android' && isTablet && !isFoldable;
  
  // Determine if device is in folded or unfolded state (for foldable devices)
  const isFolded = isFoldable && (
    (SCREEN_WIDTH <= 560 && SCREEN_HEIGHT >= 2600) ||
    (SCREEN_HEIGHT <= 560 && SCREEN_WIDTH >= 2600) ||
    (SCREEN_WIDTH <= 900 && SCREEN_HEIGHT >= 2100) ||
    (SCREEN_HEIGHT <= 900 && SCREEN_WIDTH >= 2100)
  );
  const isUnfolded = isFoldable && !isFolded;
  
  return {
    isPhone,
    isTablet: isTablet || isFoldable, // Foldable devices treated as tablet
    isSurface,
    isSurfaceDuo,
    isSamsungFold,
    isFoldable,
    isFolded,
    isUnfolded,
    isIPad,
    isAndroidTablet,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    isWindows: Platform.OS === 'windows',
    aspectRatio,
    isLandscape,
    isPortrait,
  };
};

// Enhanced screen size detection
export const getScreenSize = () => {
  const { isTablet, isPhone } = getDeviceType();
  
  if (isPhone) {
    if (SCREEN_WIDTH < 375) return 'small-phone';
    if (SCREEN_WIDTH < 414) return 'medium-phone';
    return 'large-phone';
  }
  
  if (isTablet) {
    if (SCREEN_WIDTH < 1024) return 'small-tablet';
    if (SCREEN_WIDTH < 1366) return 'medium-tablet';
    return 'large-tablet';
  }
  
  return 'unknown';
};

// Responsive scaling with device-specific adjustments
export const getResponsiveScale = (size: number, deviceType?: string) => {
  const device = getDeviceType();
  const screenSize = getScreenSize();
  
  let scaleFactor = 1;
  
  // Base scaling
  if (device.isPhone) {
    scaleFactor = SCREEN_WIDTH / 375; // iPhone base width
  } else if (device.isTablet) {
    scaleFactor = SCREEN_WIDTH / 768; // iPad base width
  }
  
  // Device-specific adjustments
  if (device.isIPad) {
    scaleFactor *= 1.2; // iPad text and elements should be larger
  } else if (device.isFoldable) {
    // Foldable devices: Adjust for folded/unfolded states
    if (device.isFolded) {
      // Folded state - single screen
      scaleFactor *= 0.95; // Slightly smaller when folded
    } else if (device.isUnfolded) {
      // Unfolded state - dual screen
      scaleFactor *= 1.15; // Larger when unfolded
    }
    // Additional adjustment for orientation
    if (device.isLandscape) {
      scaleFactor *= 1.05; // Slightly larger in landscape
    }
  } else if (device.isSurface) {
    scaleFactor *= 1.1; // Surface devices
  } else if (device.isAndroidTablet) {
    scaleFactor *= 1.15; // Android tablets
  }
  
  // Orientation adjustments for all devices
  if (device.isLandscape) {
    // In landscape, scale horizontally more
    scaleFactor *= (SCREEN_WIDTH / SCREEN_HEIGHT) * 0.5;
  }
  
  // Screen size adjustments
  switch (screenSize) {
    case 'small-phone':
      scaleFactor *= 0.9;
      break;
    case 'large-phone':
      scaleFactor *= 1.1;
      break;
    case 'small-tablet':
      scaleFactor *= 0.9;
      break;
    case 'large-tablet':
      scaleFactor *= 1.2;
      break;
  }
  
  return Math.round(size * scaleFactor);
};

// Enhanced font scaling
export const getResponsiveFontSize = (size: number, options?: {
  minSize?: number;
  maxSize?: number;
  deviceType?: string;
}) => {
  const device = getDeviceType();
  const { minSize = size * 0.8, maxSize = size * 1.5 } = options || {};
  
  let scaledSize = getResponsiveScale(size);
  
  // Platform-specific adjustments
  if (device.isIOS) {
    scaledSize *= 1.05; // iOS renders fonts slightly smaller
  } else if (device.isAndroid) {
    scaledSize *= 0.98; // Android renders fonts slightly larger
  }
  
  // Device-specific adjustments
  if (device.isIPad) {
    scaledSize *= 1.1; // iPad needs larger fonts
  } else if (device.isFoldable) {
    // Foldable devices font scaling
    if (device.isFolded) {
      scaledSize *= 0.98; // Slightly smaller fonts when folded
    } else if (device.isUnfolded) {
      scaledSize *= 1.08; // Larger fonts when unfolded
    }
    // Landscape adjustment for foldables
    if (device.isLandscape) {
      scaledSize *= 1.02;
    }
  } else if (device.isSurface) {
    scaledSize *= 1.05; // Surface devices
  }
  
  return Math.max(minSize, Math.min(maxSize, scaledSize));
};

// Enhanced spacing
export const getResponsiveSpacing = (size: number) => {
  const device = getDeviceType();
  let spacing = getResponsiveScale(size);
  
  // Device-specific spacing adjustments
  if (device.isTablet) {
    spacing *= 1.3; // Tablets need more spacing
  }
  
  if (device.isIPad) {
    spacing *= 1.2; // iPad specific
  } else if (device.isFoldable) {
    // Foldable devices spacing adjustments
    if (device.isFolded) {
      spacing *= 0.9; // Tighter spacing when folded (single screen)
    } else if (device.isUnfolded) {
      spacing *= 1.15; // More spacing when unfolded (dual screen)
    }
    // Landscape spacing adjustment
    if (device.isLandscape) {
      spacing *= 1.1;
    }
  } else if (device.isSurface) {
    spacing *= 1.1; // Surface specific
  }
  
  // Orientation-based spacing adjustments
  if (device.isLandscape && device.isPhone) {
    spacing *= 0.85; // Tighter spacing in landscape for phones
  }
  
  return spacing;
};

// Enhanced padding
export const getResponsivePadding = (size: number) => {
  return getResponsiveSpacing(size);
};

// Enhanced border radius
export const getResponsiveBorderRadius = (size: number) => {
  const device = getDeviceType();
  let radius = getResponsiveScale(size);
  
  // Device-specific radius adjustments
  if (device.isTablet) {
    radius *= 1.2; // Tablets can have larger radius
  }
  
  return radius;
};

// Safe area helpers for all platforms
export const getSafeAreaInsets = () => {
  const device = getDeviceType();
  
  return {
    top: device.isIOS ? (SCREEN_HEIGHT > 800 ? 44 : 20) : 24,
    bottom: device.isIOS ? (SCREEN_HEIGHT > 800 ? 34 : 0) : 0,
    left: 0,
    right: 0,
  };
};

// Responsive button dimensions
export const getResponsiveButtonSize = () => {
  const device = getDeviceType();
  const screenSize = getScreenSize();
  
  let height = 48;
  let minWidth = 120;
  
  if (device.isPhone) {
    switch (screenSize) {
      case 'small-phone':
        height = 44;
        minWidth = 100;
        break;
      case 'large-phone':
        height = 52;
        minWidth = 140;
        break;
    }
  } else if (device.isTablet) {
    height = 56;
    minWidth = 160;
    
    if (device.isIPad) {
      height = 60;
      minWidth = 180;
    } else if (device.isFoldable) {
      // Foldable devices button sizes
      if (device.isFolded) {
        height = 52; // Smaller when folded
        minWidth = 140;
      } else if (device.isUnfolded) {
        height = 60; // Larger when unfolded
        minWidth = 180;
      }
      // Landscape adjustment
      if (device.isLandscape) {
        height += 4;
        minWidth += 20;
      }
    } else if (device.isSurface) {
      height = 58;
      minWidth = 170;
    }
    
    // Landscape orientation adjustments for all tablets
    if (device.isLandscape && device.isTablet) {
      height += 4;
      minWidth += 30;
    }
  }
  
  return { height, minWidth };
};

// Responsive icon sizes
export const getResponsiveIconSize = (baseSize: number) => {
  const device = getDeviceType();
  let size = getResponsiveScale(baseSize);
  
  if (device.isTablet) {
    size *= 1.3; // Tablets need larger icons
  }
  
  if (device.isIPad) {
    size *= 1.2; // iPad specific
  }
  
  return size;
};

// Responsive layout helpers - Enhanced for all devices
export const getResponsiveLayout = () => {
  const device = getDeviceType();
  const screenSize = getScreenSize();
  
  // Base values
  let containerPadding = device.isTablet ? 24 : 16;
  let cardSpacing = device.isTablet ? 20 : 16;
  let gridColumns = device.isTablet ? 2 : 1;
  let tabBarHeight = device.isTablet ? 80 : 70;
  let headerHeight = device.isTablet ? 80 : 60;
  let footerHeight = device.isTablet ? 100 : 80;
  
  // Foldable device adjustments
  if (device.isFoldable) {
    if (device.isFolded) {
      containerPadding = 14;
      cardSpacing = 12;
      gridColumns = 1; // Single column when folded
      tabBarHeight = 70;
      headerHeight = 60;
    } else if (device.isUnfolded) {
      containerPadding = 28;
      cardSpacing = 24;
      gridColumns = device.isLandscape ? 3 : 2; // More columns when unfolded
      tabBarHeight = 90;
      headerHeight = 90;
    }
  }
  
  // Orientation adjustments
  if (device.isLandscape) {
    if (device.isPhone) {
      containerPadding = 12;
      cardSpacing = 10;
      gridColumns = 2; // Two columns in landscape for phones
    } else if (device.isTablet) {
      gridColumns = 3; // More columns in landscape for tablets
      containerPadding = 32;
      cardSpacing = 28;
    }
  }
  
  // Device-specific modal dimensions
  let modalWidth = SCREEN_WIDTH * 0.9;
  let modalHeight = SCREEN_HEIGHT * 0.7;
  
  if (device.isTablet) {
    modalWidth = Math.min(SCREEN_WIDTH * 0.8, 600);
    modalHeight = Math.min(SCREEN_HEIGHT * 0.8, 500);
    
    if (device.isFoldable && device.isUnfolded) {
      modalWidth = Math.min(SCREEN_WIDTH * 0.75, 800);
      modalHeight = Math.min(SCREEN_HEIGHT * 0.75, 600);
    }
  }
  
  if (device.isLandscape) {
    modalWidth = Math.min(SCREEN_WIDTH * 0.7, 900);
    modalHeight = Math.min(SCREEN_HEIGHT * 0.9, 600);
  }
  
  return {
    containerPadding,
    cardSpacing,
    gridColumns,
    modalWidth,
    modalHeight,
    tabBarHeight,
    headerHeight,
    footerHeight,
  };
};

// Platform-specific color adjustments
export const getPlatformColors = () => {
  const device = getDeviceType();
  
  const baseColors = {
    primary: '#259B9A',
    background: '#1a1a1a',
    white: '#FFFFFF',
    text: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    border: '#333333',
  };
  
  // Platform-specific adjustments
  if (device.isIOS) {
    return {
      ...baseColors,
      shadow: 'rgba(0, 0, 0, 0.1)',
    };
  } else if (device.isAndroid) {
    return {
      ...baseColors,
      shadow: 'rgba(0, 0, 0, 0.3)',
    };
  } else if (device.isWindows) {
    return {
      ...baseColors,
      shadow: 'rgba(0, 0, 0, 0.2)',
    };
  }
  
  return baseColors;
};

// Responsive breakpoints
export const getBreakpoints = () => {
  return {
    phone: { min: 0, max: 767 },
    tablet: { min: 768, max: 1023 },
    desktop: { min: 1024, max: Infinity },
  };
};

// Media query helper
export const isBreakpoint = (breakpoint: 'phone' | 'tablet' | 'desktop') => {
  const breakpoints = getBreakpoints();
  const bp = breakpoints[breakpoint];
  return SCREEN_WIDTH >= bp.min && SCREEN_WIDTH <= bp.max;
};

// Helper to get current dimensions (call this dynamically for orientation changes)
export const getCurrentDimensions = () => {
  return Dimensions.get('window');
};

// Helper to setup orientation change listener (returns cleanup function)
export const setupOrientationListener = (callback: (dimensions: { width: number; height: number }) => void) => {
  const subscription = Dimensions.addEventListener('change', ({ window }) => {
    callback(window);
  });
  
  return () => subscription?.remove();
};

// Helper to check if device supports orientation changes
export const supportsOrientationChange = () => {
  const device = getDeviceType();
  // All modern devices support orientation changes
  return device.isIOS || device.isAndroid || device.isWindows;
};

// Get optimal video dimensions for current device
export const getOptimalVideoDimensions = () => {
  const device = getDeviceType();
  const layout = getResponsiveLayout();
  
  let width = SCREEN_WIDTH * 0.95;
  let height = SCREEN_HEIGHT * 0.5;
  
  if (device.isTablet) {
    if (device.isFoldable) {
      if (device.isFolded) {
        width = SCREEN_WIDTH * 0.92;
        height = SCREEN_HEIGHT * 0.48;
      } else if (device.isUnfolded) {
        width = Math.min(SCREEN_WIDTH * 0.85, 800);
        height = device.isLandscape 
          ? Math.min(SCREEN_HEIGHT * 0.6, 500)
          : Math.min(SCREEN_HEIGHT * 0.55, 550);
      }
    } else {
      width = Math.min(SCREEN_WIDTH * 0.85, 800);
      height = device.isLandscape 
        ? Math.min(SCREEN_HEIGHT * 0.6, 500)
        : Math.min(SCREEN_HEIGHT * 0.55, 550);
    }
  } else if (device.isPhone) {
    width = SCREEN_WIDTH * 0.95;
    height = device.isLandscape
      ? Math.min(SCREEN_HEIGHT * 0.6, 400)
      : Math.min(SCREEN_HEIGHT * 0.5, 440);
  }
  
  return { width, height };
};

// Helper to get responsive dimensions with min/max constraints
export const getResponsiveDimensions = (
  baseWidth: number,
  baseHeight: number,
  options?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  }
) => {
  const device = getDeviceType();
  const { minWidth, maxWidth, minHeight, maxHeight } = options || {};
  
  let width = getResponsiveScale(baseWidth);
  let height = getResponsiveScale(baseHeight);
  
  // Apply orientation adjustments
  if (device.isLandscape) {
    width = width * 1.1;
    height = height * 0.9;
  }
  
  // Apply constraints
  if (minWidth) width = Math.max(width, minWidth);
  if (maxWidth) width = Math.min(width, maxWidth);
  if (minHeight) height = Math.max(height, minHeight);
  if (maxHeight) height = Math.min(height, maxHeight);
  
  return { width, height };
};

export {
    SCREEN_HEIGHT, SCREEN_WIDTH
};





