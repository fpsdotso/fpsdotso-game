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

  const animationFrameRef = useRef(null);
  const lastInputRef = useRef(null);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobileDevice = width < 1000; // Changed to just check width < 1000px
      console.log(
        `📱 Mobile detection: window=${width}x${height}, isMobile=${isMobileDevice}`
      );
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initialize joystick positions
  useEffect(() => {
    if (isMobile) {
      const margin = 80;
      const screenHeight = window.innerHeight;

      setLeftJoystick((prev) => ({
        ...prev,
        center: { x: margin, y: screenHeight - margin },
        knob: { x: margin, y: screenHeight - margin },
      }));
    }
  }, [isMobile]);

  // Calculate joystick direction
  const getJoystickDirection = useCallback((joystick) => {
    if (!joystick.isActive) return { x: 0, y: 0 };

    const dx = joystick.knob.x - joystick.center.x;
    const dy = joystick.knob.y - joystick.center.y;
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

    return {
      forward: direction.y < -0.3,
      backward: direction.y > 0.3,
      left: direction.x < -0.3,
      right: direction.x > 0.3,
    };
  }, [leftJoystick, getJoystickDirection]);

  // Get camera look input from screen touch movement
  const getLookInput = useCallback(() => {
    if (!cameraTouch.isActive) return { deltaX: 0, deltaY: 0 };

    // Scale the input to match mouse sensitivity
    return {
      deltaX: cameraTouch.deltaX * 2.0,
      deltaY: cameraTouch.deltaY * 2.0,
    };
  }, [cameraTouch]);

  // Send input to game bridge
  const sendInput = useCallback(() => {
    if (!isPlaying || !gameId || !window.gameBridge?.sendPlayerInput) return;

    // Check if wallet is connected by checking if gameBridge has wallet info
    if (!window.gameBridge.getCurrentPlayerAuthority) {
      console.log("🎮 Wallet not connected - joystick input disabled");
      return;
    }

    const movement = getMovementInput();
    const look = getLookInput();

    // Only send if there's actual input
    const hasMovement =
      movement.forward || movement.backward || movement.left || movement.right;
    const hasLook =
      Math.abs(look.deltaX) > 0.01 || Math.abs(look.deltaY) > 0.01;

    if (hasMovement || hasLook) {
      const input = {
        forward: movement.forward,
        backward: movement.backward,
        left: movement.left,
        right: movement.right,
        deltaX: look.deltaX,
        deltaY: look.deltaY,
        deltaTime: 0.033, // 33ms default
        sensitivity: 1.0,
        gameId: gameId,
      };

      // Avoid sending duplicate inputs
      const inputStr = JSON.stringify(input);
      if (lastInputRef.current !== inputStr) {
        lastInputRef.current = inputStr;
        window.gameBridge.sendPlayerInput(input).catch((error) => {
          console.error("Failed to send player input:", error);
        });
      }
    }
  }, [isPlaying, gameId, getMovementInput, getLookInput]);

  // Continuous input sending
  useEffect(() => {
    if (
      isPlaying &&
      isMobile &&
      (leftJoystick.isActive || cameraTouch.isActive)
    ) {
      const animate = () => {
        sendInput();
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
    sendInput,
  ]);

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
      e.preventDefault();
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      const distance = Math.sqrt(
        Math.pow(touchX - leftJoystick.center.x, 2) +
          Math.pow(touchY - leftJoystick.center.y, 2)
      );

      if (distance <= leftJoystick.radius) {
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

      const dx = touchX - leftJoystick.center.x;
      const dy = touchY - leftJoystick.center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let knobX = touchX;
      let knobY = touchY;

      if (distance > leftJoystick.radius) {
        const angle = Math.atan2(dy, dx);
        knobX = leftJoystick.center.x + Math.cos(angle) * leftJoystick.radius;
        knobY = leftJoystick.center.y + Math.sin(angle) * leftJoystick.radius;
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
        knob: { x: prev.center.x, y: prev.center.y },
      }));
    },
    [leftJoystick]
  );

  // Don't render if not mobile or not playing
  if (!isMobile || !isPlaying) {
    console.log(
      `🎮 VirtualJoystick render check: isMobile=${isMobile}, isPlaying=${isPlaying}`
    );
    return null;
  }

  console.log(
    `🎮 VirtualJoystick rendering: isMobile=${isMobile}, isPlaying=${isPlaying}`
  );

  return (
    <div
      className="virtual-joysticks"
      onTouchStart={handleCameraTouchStart}
      onTouchMove={handleCameraTouchMove}
      onTouchEnd={handleCameraTouchEnd}
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
        className="joystick-container left-joystick"
        onTouchStart={handleJoystickTouchStart}
        onTouchMove={handleJoystickTouchMove}
        onTouchEnd={handleJoystickTouchEnd}
        style={{
          left: `${leftJoystick.center.x - leftJoystick.radius}px`,
          top: `${leftJoystick.center.y - leftJoystick.radius}px`,
        }}
      >
        <div className="joystick-background" />
        <div
          className="joystick-knob"
          style={{
            left: `${leftJoystick.knob.x - leftJoystick.center.x}px`,
            top: `${leftJoystick.knob.y - leftJoystick.center.y}px`,
            opacity: leftJoystick.isActive ? 1 : 0.7,
          }}
        />
      </div>
    </div>
  );
};

export default VirtualJoystick;
