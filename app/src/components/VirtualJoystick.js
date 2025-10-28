import React, { useState, useEffect, useRef, useCallback } from "react";
import "./VirtualJoystick.css";

const VirtualJoystick = ({ isPlaying, gameId, onInput }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [leftJoystick, setLeftJoystick] = useState({
    center: { x: 0, y: 0 },
    knob: { x: 0, y: 0 },
    isActive: false,
    touchId: null,
    radius: 60,
    knobRadius: 18,
    deadzone: 0.1,
  });

  // Camera control state
  const [cameraTouch, setCameraTouch] = useState({
    isActive: false,
    touchId: null,
    lastX: 0,
    lastY: 0,
    deltaX: 0,
    deltaY: 0,
  });

  // Shoot button state
  const [shootButton, setShootButton] = useState({
    isPressed: false,
    touchId: null,
  });

  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);
  const joystickRef = useRef(null);

  // Mobile detection and joystick positioning
  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileDevice = width < 1000; // Changed to just check width < 1000px
      console.log(
        `📱 Mobile detection: window=${width}x${height}, isMobile=${isMobileDevice}`
      );
      setIsMobile(isMobileDevice);

      // Update joystick position if mobile
      if (isMobileDevice) {
        const joystickRadius = 60;
        const margin = 100; // Increased margin to prevent cutoff

        // Position joystick in bottom-left corner with proper margins
        const x = margin + joystickRadius; // Left margin + radius to center
        const y = height - margin - joystickRadius; // Bottom margin + radius to center

        setLeftJoystick((prev) => ({
          ...prev,
          center: { x, y },
          knob: { x: 60, y: 60 }, // Center of the 120x120 container
        }));

        console.log(
          `🎮 Joystick positioned at: x=${x}, y=${y} (screen: ${width}x${height})`
        );
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Handle camera touch events
  const handleCameraTouchStart = useCallback(
    (e) => {
      e.preventDefault();

      const touch = e.touches[0];

      // Check if this touch is not on the left joystick
      const rect = e.currentTarget.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      const joystickDistance = Math.sqrt(
        Math.pow(touchX - leftJoystick.center.x, 2) +
          Math.pow(touchY - leftJoystick.center.y, 2)
      );

      // Only start camera control if touch is not on the joystick
      if (joystickDistance > leftJoystick.radius) {
        setCameraTouch({
          isActive: true,
          touchId: touch.identifier,
          lastX: touch.clientX,
          lastY: touch.clientY,
          deltaX: 0,
          deltaY: 0,
        });
      }
    },
    [leftJoystick]
  );

  const handleCameraTouchMove = useCallback(
    (e) => {
      e.preventDefault();

      if (!cameraTouch.isActive) return;

      const touch = Array.from(e.touches).find(
        (t) => t.identifier === cameraTouch.touchId
      );
      if (!touch) return;

      const deltaX = touch.clientX - cameraTouch.lastX;
      const deltaY = touch.clientY - cameraTouch.lastY;

      setCameraTouch((prev) => ({
        ...prev,
        deltaX,
        deltaY,
        lastX: touch.clientX,
        lastY: touch.clientY,
      }));
    },
    [cameraTouch]
  );

  const handleCameraTouchEnd = useCallback(
    (e) => {
      e.preventDefault();

      if (!cameraTouch.isActive) return;

      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === cameraTouch.touchId
      );
      if (!touch) return;

      setCameraTouch({
        isActive: false,
        touchId: null,
        lastX: 0,
        lastY: 0,
        deltaX: 0,
        deltaY: 0,
      });
    },
    [cameraTouch]
  );

  // Handle joystick touch events
  const handleJoystickTouchStart = useCallback(
    (e) => {
      console.log("🎮 Joystick touch start!", e.touches.length);
      e.preventDefault();

      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();

      // Convert touch coordinates to joystick container coordinates
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      // The joystick center is at the center of the 120x120 container (60, 60)
      const joystickCenterX = 60; // Half of container width
      const joystickCenterY = 60; // Half of container height

      const distance = Math.sqrt(
        Math.pow(touchX - joystickCenterX, 2) +
          Math.pow(touchY - joystickCenterY, 2)
      );

      console.log(
        "🎮 Touch distance:",
        distance,
        "radius:",
        leftJoystick.radius
      );

      if (distance <= leftJoystick.radius) {
        console.log("🎮 Joystick activated!");
        setLeftJoystick((prev) => ({
          ...prev,
          isActive: true,
          touchId: touch.identifier,
          knob: { x: touchX, y: touchY },
        }));
      }
    },
    [leftJoystick]
  );

  const handleJoystickTouchMove = useCallback(
    (e) => {
      e.preventDefault();

      if (!leftJoystick.isActive) return;

      const touch = Array.from(e.touches).find(
        (t) => t.identifier === leftJoystick.touchId
      );
      if (!touch) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      // The joystick center is at the center of the 120x120 container (60, 60)
      const joystickCenterX = 60; // Half of container width
      const joystickCenterY = 60; // Half of container height

      const dx = touchX - joystickCenterX;
      const dy = touchY - joystickCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let knobX = touchX;
      let knobY = touchY;

      if (distance > leftJoystick.radius) {
        const angle = Math.atan2(dy, dx);
        knobX = joystickCenterX + Math.cos(angle) * leftJoystick.radius;
        knobY = joystickCenterY + Math.sin(angle) * leftJoystick.radius;
      }

      setLeftJoystick((prev) => ({
        ...prev,
        knob: { x: knobX, y: knobY },
      }));
    },
    [leftJoystick]
  );

  const handleJoystickTouchEnd = useCallback(
    (e) => {
      e.preventDefault();

      if (!leftJoystick.isActive) return;

      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === leftJoystick.touchId
      );
      if (!touch) return;

      setLeftJoystick((prev) => ({
        ...prev,
        isActive: false,
        touchId: null,
        knob: { x: 60, y: 60 }, // Reset to center of container
      }));

      // Clear joystick input when released
      if (window.Module) {
        window.joystickInput = {
          forward: false,
          backward: false,
          left: false,
          right: false,
        };
        console.log("🎮 Joystick input cleared on touch end");
      }
    },
    [leftJoystick]
  );

  // Handle joystick mouse events (for browser mobile emulation)
  const handleJoystickMouseDown = useCallback(
    (e) => {
      console.log("🎮 Joystick mouse down!", e);
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // The joystick center is at the center of the 120x120 container (60, 60)
      const joystickCenterX = 60; // Half of container width
      const joystickCenterY = 60; // Half of container height

      const distance = Math.sqrt(
        Math.pow(mouseX - joystickCenterX, 2) +
          Math.pow(mouseY - joystickCenterY, 2)
      );

      console.log(
        "🎮 Mouse distance:",
        distance,
        "radius:",
        leftJoystick.radius
      );

      if (distance <= leftJoystick.radius) {
        console.log("🎮 Joystick activated via mouse!");
        setLeftJoystick((prev) => ({
          ...prev,
          isActive: true,
          touchId: 999, // Use a special ID for mouse
          knob: { x: mouseX, y: mouseY },
        }));
      }
    },
    [leftJoystick]
  );

  const handleJoystickMouseMove = useCallback(
    (e) => {
      e.preventDefault();

      if (!leftJoystick.isActive || leftJoystick.touchId !== 999) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // The joystick center is at the center of the 120x120 container (60, 60)
      const joystickCenterX = 60; // Half of container width
      const joystickCenterY = 60; // Half of container height

      const dx = mouseX - joystickCenterX;
      const dy = mouseY - joystickCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let knobX = mouseX;
      let knobY = mouseY;

      if (distance > leftJoystick.radius) {
        const angle = Math.atan2(dy, dx);
        knobX = joystickCenterX + Math.cos(angle) * leftJoystick.radius;
        knobY = joystickCenterY + Math.sin(angle) * leftJoystick.radius;
      }

      setLeftJoystick((prev) => ({
        ...prev,
        knob: { x: knobX, y: knobY },
      }));
    },
    [leftJoystick]
  );

  const handleJoystickMouseUp = useCallback(
    (e) => {
      e.preventDefault();

      if (!leftJoystick.isActive || leftJoystick.touchId !== 999) return;

      console.log("🎮 Joystick deactivated via mouse!");
      setLeftJoystick((prev) => ({
        ...prev,
        isActive: false,
        touchId: null,
        knob: { x: 60, y: 60 }, // Reset to center of container
      }));

      // Clear joystick input when released
      if (window.Module) {
        window.joystickInput = {
          forward: false,
          backward: false,
          left: false,
          right: false,
        };
        console.log("🎮 Joystick input cleared on mouse up");
      }
    },
    [leftJoystick]
  );

  // Handle camera mouse events (for browser mobile emulation)
  const handleCameraMouseDown = useCallback(
    (e) => {
      e.preventDefault();

      // Check if this mouse click is not on the left joystick
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const joystickDistance = Math.sqrt(
        Math.pow(mouseX - leftJoystick.center.x, 2) +
          Math.pow(mouseY - leftJoystick.center.y, 2)
      );

      // Only start camera control if mouse is not on the joystick
      if (joystickDistance > leftJoystick.radius) {
        setCameraTouch({
          isActive: true,
          touchId: 999, // Use special ID for mouse
          lastX: e.clientX,
          lastY: e.clientY,
          deltaX: 0,
          deltaY: 0,
        });
        console.log("📷 Camera mouse control started");
      }
    },
    [leftJoystick]
  );

  const handleCameraMouseMove = useCallback(
    (e) => {
      e.preventDefault();

      if (!cameraTouch.isActive || cameraTouch.touchId !== 999) return;

      const deltaX = e.clientX - cameraTouch.lastX;
      const deltaY = e.clientY - cameraTouch.lastY;

      setCameraTouch((prev) => ({
        ...prev,
        deltaX,
        deltaY,
        lastX: e.clientX,
        lastY: e.clientY,
      }));
    },
    [cameraTouch]
  );

  const handleCameraMouseUp = useCallback(
    (e) => {
      e.preventDefault();

      if (!cameraTouch.isActive || cameraTouch.touchId !== 999) return;

      setCameraTouch({
        isActive: false,
        touchId: null,
        lastX: 0,
        lastY: 0,
        deltaX: 0,
        deltaY: 0,
      });
      console.log("📷 Camera mouse control ended");
    },
    [cameraTouch]
  );

  // Handle shoot button events
  const handleShootButtonTouchStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    setShootButton({
      isPressed: true,
      touchId: touch.identifier,
    });
    console.log("🔫 Shoot button pressed!");
  }, []);

  const handleShootButtonTouchEnd = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!shootButton.isPressed) return;

      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === shootButton.touchId
      );
      if (!touch) return;

      setShootButton({
        isPressed: false,
        touchId: null,
      });
      console.log("🔫 Shoot button released!");
    },
    [shootButton]
  );

  const handleShootButtonMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setShootButton({
      isPressed: true,
      touchId: 999, // Use special ID for mouse
    });
    console.log("🔫 Shoot button mouse down!");
  }, []);

  const handleShootButtonMouseUp = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!shootButton.isPressed || shootButton.touchId !== 999) return;

      setShootButton({
        isPressed: false,
        touchId: null,
      });
      console.log("🔫 Shoot button mouse up!");
    },
    [shootButton]
  );

  // Set up proper event listeners with passive: false
  useEffect(() => {
    const container = containerRef.current;
    const joystick = joystickRef.current;
    if (!container || !joystick || !isMobile) return;

    // Add event listeners with passive: false to allow preventDefault
    const options = { passive: false };

    console.log("🎮 Setting up touch event listeners", {
      container: !!container,
      joystick: !!joystick,
      isMobile,
    });

    // Camera touch events on container
    container.addEventListener("touchstart", handleCameraTouchStart, options);
    container.addEventListener("touchmove", handleCameraTouchMove, options);
    container.addEventListener("touchend", handleCameraTouchEnd, options);

    // Joystick touch events on joystick element
    joystick.addEventListener("touchstart", handleJoystickTouchStart, options);
    joystick.addEventListener("touchmove", handleJoystickTouchMove, options);
    joystick.addEventListener("touchend", handleJoystickTouchEnd, options);

    // Also add mouse events for browser mobile emulation
    joystick.addEventListener("mousedown", handleJoystickMouseDown, options);
    joystick.addEventListener("mousemove", handleJoystickMouseMove, options);
    joystick.addEventListener("mouseup", handleJoystickMouseUp, options);

    // Camera mouse events on container
    container.addEventListener("mousedown", handleCameraMouseDown, options);
    container.addEventListener("mousemove", handleCameraMouseMove, options);
    container.addEventListener("mouseup", handleCameraMouseUp, options);

    return () => {
      container.removeEventListener("touchstart", handleCameraTouchStart);
      container.removeEventListener("touchmove", handleCameraTouchMove);
      container.removeEventListener("touchend", handleCameraTouchEnd);

      joystick.removeEventListener("touchstart", handleJoystickTouchStart);
      joystick.removeEventListener("touchmove", handleJoystickTouchMove);
      joystick.removeEventListener("touchend", handleJoystickTouchEnd);

      joystick.removeEventListener("mousedown", handleJoystickMouseDown);
      joystick.removeEventListener("mousemove", handleJoystickMouseMove);
      joystick.removeEventListener("mouseup", handleJoystickMouseUp);

      container.removeEventListener("mousedown", handleCameraMouseDown);
      container.removeEventListener("mousemove", handleCameraMouseMove);
      container.removeEventListener("mouseup", handleCameraMouseUp);
    };
  }, [
    isMobile,
    handleCameraTouchStart,
    handleCameraTouchMove,
    handleCameraTouchEnd,
    handleJoystickTouchStart,
    handleJoystickTouchMove,
    handleJoystickTouchEnd,
    handleJoystickMouseDown,
    handleJoystickMouseMove,
    handleJoystickMouseUp,
    handleCameraMouseDown,
    handleCameraMouseMove,
    handleCameraMouseUp,
  ]);

  // Calculate joystick direction
  const getJoystickDirection = useCallback((joystick) => {
    if (!joystick.isActive) return { x: 0, y: 0 };

    // The joystick center is at the center of the 120x120 container (60, 60)
    const joystickCenterX = 60; // Half of container width
    const joystickCenterY = 60; // Half of container height

    const dx = joystick.knob.x - joystickCenterX;
    const dy = joystick.knob.y - joystickCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < joystick.deadzone * joystick.radius) {
      return { x: 0, y: 0 };
    }

    const normalizedDistance =
      Math.min(distance, joystick.radius) / joystick.radius;
    return {
      x: (dx / distance) * normalizedDistance,
      y: (dy / distance) * normalizedDistance,
    };
  }, []);

  // Convert joystick direction to movement booleans
  const getMovementInput = useCallback(() => {
    const direction = getJoystickDirection(leftJoystick);

    const movement = {
      forward: direction.y < -0.3,
      backward: direction.y > 0.3,
      left: direction.x < -0.3,
      right: direction.x > 0.3,
    };

    // Debug logging
    if (leftJoystick.isActive) {
      console.log("🎮 Joystick direction:", direction, "Movement:", movement);
    }

    return movement;
  }, [leftJoystick, getJoystickDirection]);

  // Send input to Rust game engine (like WASD does)
  const sendInput = useCallback(() => {
    if (!isPlaying || !window.Module) return;

    const movement = getMovementInput();

    // Call Player.update() directly with joystick input
    try {
      // The Player.update() function now accepts joystick input as third parameter
      // We need to call it through the game engine's update cycle
      // Since Player.update() is called internally by the game engine,
      // we need to set the joystick state and let the engine handle it

      // For now, we'll use a simple approach - set joystick state in a global variable
      // that the Rust game engine can read during its update cycle
      window.joystickInput = {
        forward: movement.forward,
        backward: movement.backward,
        left: movement.left,
        right: movement.right,
      };

      console.log("🎮 Joystick input set for game engine:", movement);
    } catch (error) {
      console.error("❌ Failed to set joystick input:", error);
    }
  }, [isPlaying, getMovementInput]);

  // Send camera input to Rust game engine
  const sendCameraInput = useCallback(() => {
    if (!isPlaying || !window.Module || !cameraTouch.isActive) return;

    try {
      // Set camera input in global variable for Rust to read
      // Match mouse sensitivity exactly (0.1) for consistent feel
      const cameraSensitivity = 0.1; // Same as mouse sensitivity

      window.cameraInput = {
        deltaX: cameraTouch.deltaX * cameraSensitivity,
        deltaY: cameraTouch.deltaY * cameraSensitivity,
      };

      console.log("📷 Camera input set:", window.cameraInput);
    } catch (error) {
      console.error("❌ Failed to set camera input:", error);
    }
  }, [isPlaying, cameraTouch]);

  // Send shoot input to Rust game engine
  const sendShootInput = useCallback(() => {
    if (!isPlaying || !window.Module || !shootButton.isPressed) return;

    try {
      // Set shoot input in global variable for Rust to read
      window.shootInput = true;
      console.log("🔫 Shoot input set for game engine");
    } catch (error) {
      console.error("❌ Failed to set shoot input:", error);
    }
  }, [isPlaying, shootButton.isPressed]);

  // Continuous input sending
  useEffect(() => {
    if (
      isPlaying &&
      isMobile &&
      (leftJoystick.isActive || cameraTouch.isActive || shootButton.isPressed)
    ) {
      const animate = () => {
        sendInput();
        sendCameraInput();
        sendShootInput();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isPlaying,
    isMobile,
    leftJoystick.isActive,
    cameraTouch.isActive,
    shootButton.isPressed,
    sendInput,
    sendCameraInput,
    sendShootInput,
  ]);

  // Don't render if not mobile or not playing
  if (!isMobile || !isPlaying) {
    console.log(
      `🎮 VirtualJoystick render check: isMobile=${isMobile}, isPlaying=${isPlaying}`
    );
    return null;
  }

  console.log(
    `🎮 VirtualJoystick rendering: isMobile=${isMobile}, isPlaying=${isPlaying}, center=(${leftJoystick.center.x}, ${leftJoystick.center.y})`
  );

  return (
    <div
      ref={containerRef}
      className="virtual-joysticks"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
        zIndex: 1000,
      }}
    >
      {/* Left Joystick - Movement */}
      <div
        ref={joystickRef}
        className="joystick-container left-joystick"
        style={{
          left: `${leftJoystick.center.x - 60}px`, // Subtract half container width
          top: `${leftJoystick.center.y - 60}px`, // Subtract half container height
        }}
      >
        <div className="joystick-background" />
        <div
          className="joystick-knob"
          style={{
            left: `${leftJoystick.knob.x}px`, // Direct positioning within container
            top: `${leftJoystick.knob.y}px`, // Direct positioning within container
            opacity: leftJoystick.isActive ? 1 : 0.7,
          }}
        />
      </div>

      {/* Shoot Button - Bottom Right */}
      <div
        className="shoot-button"
        style={{
          position: "absolute",
          right: "100px", // Right margin
          bottom: "100px", // Bottom margin
          width: "90px",
          height: "90px",
          borderRadius: "50%",
          backgroundColor: shootButton.isPressed ? "#cc3333" : "#e74c3c",
          border: "4px solid #ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          userSelect: "none",
          opacity: shootButton.isPressed ? 0.85 : 1.0,
          transition: "all 0.15s ease",
          boxShadow: "0 6px 12px rgba(0, 0, 0, 0.4)",
          // Add inner shadow for depth
          background: shootButton.isPressed
            ? "radial-gradient(circle, #cc3333 0%, #aa2222 100%)"
            : "radial-gradient(circle, #e74c3c 0%, #c0392b 100%)",
        }}
        onTouchStart={handleShootButtonTouchStart}
        onTouchEnd={handleShootButtonTouchEnd}
        onMouseDown={handleShootButtonMouseDown}
        onMouseUp={handleShootButtonMouseUp}
      >
        <img
          src="/bullet.png"
          alt="Shoot"
          style={{
            width: "50px",
            height: "50px",
            objectFit: "contain",
            // Remove filter to show original bullet colors
          }}
        />
      </div>
    </div>
  );
};

export default VirtualJoystick;
