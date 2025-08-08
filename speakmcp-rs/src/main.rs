use rdev::{listen, Event, EventType};
use serde::Serialize;
use serde_json::json;
use std::env;
use std::process;

#[derive(Serialize)]
struct RdevEvent {
    event_type: String,
    name: Option<String>,
    time: std::time::SystemTime,
    data: String,
}

/// Platform-specific error types for better error reporting
#[derive(Debug)]
enum PlatformError {
    AccessibilityDenied,
    WaylandNotSupported,
    X11NotAvailable,
    PlatformNotSupported,
    InitializationFailed(String),
}

impl std::fmt::Display for PlatformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlatformError::AccessibilityDenied => write!(f, "macOS Accessibility permissions required"),
            PlatformError::WaylandNotSupported => write!(f, "Wayland is not supported, X11 session required"),
            PlatformError::X11NotAvailable => write!(f, "X11 display server not available"),
            PlatformError::PlatformNotSupported => write!(f, "Platform not supported"),
            PlatformError::InitializationFailed(msg) => write!(f, "Platform initialization failed: {}", msg),
        }
    }
}

impl std::error::Error for PlatformError {}


/// Platform-specific initialization and capability checks
mod platform {
    use super::PlatformError;
    
    /// Check platform requirements and initialize if necessary
    pub fn check_platform_requirements() -> Result<(), PlatformError> {
        #[cfg(target_os = "macos")]
        {
            check_macos_accessibility()
        }
        
        #[cfg(target_os = "linux")]
        {
            check_linux_display_server()
        }
        
        #[cfg(target_os = "windows")]
        {
            // Windows doesn't require special checks for basic functionality
            Ok(())
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err(PlatformError::PlatformNotSupported)
        }
    }
    
    #[cfg(target_os = "macos")]
    fn check_macos_accessibility() -> Result<(), PlatformError> {
        // Note: We can't actually check accessibility permissions programmatically
        // from Rust without additional dependencies, so we issue a warning
        eprintln!("Warning: This application requires Accessibility permissions on macOS.");
        eprintln!("If keyboard events are not working, please grant permissions in:");
        eprintln!("System Preferences > Security & Privacy > Privacy > Accessibility");
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    fn check_linux_display_server() -> Result<(), PlatformError> {
        // Check if we're running under Wayland
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            // Check if XDG_SESSION_TYPE explicitly says wayland
            if let Ok(session_type) = std::env::var("XDG_SESSION_TYPE") {
                if session_type.to_lowercase() == "wayland" {
                    return Err(PlatformError::WaylandNotSupported);
                }
            }
            
            // If WAYLAND_DISPLAY is set but no X11 fallback, likely pure Wayland
            if std::env::var("DISPLAY").is_err() {
                return Err(PlatformError::WaylandNotSupported);
            }
        }
        
        // Check if X11 is available
        if std::env::var("DISPLAY").is_err() {
            return Err(PlatformError::X11NotAvailable);
        }
        
        Ok(())
    }
    
    pub fn get_platform_info() -> String {
        #[cfg(target_os = "windows")]
        return "Windows".to_string();
        
        #[cfg(target_os = "macos")]
        return "macOS".to_string();
        
        #[cfg(target_os = "linux")]
        {
            let display_server = if std::env::var("WAYLAND_DISPLAY").is_ok() {
                "Wayland"
            } else if std::env::var("DISPLAY").is_ok() {
                "X11"
            } else {
                "Unknown"
            };
            return format!("Linux ({})", display_server);
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return "Unsupported".to_string();
    }
}

fn deal_event_to_json(event: Event) -> RdevEvent {
    let mut jsonify_event = RdevEvent {
        event_type: "".to_string(),
        name: event.name,
        time: event.time,
        data: "".to_string(),
    };
    match event.event_type {
        EventType::KeyPress(key) => {
            jsonify_event.event_type = "KeyPress".to_string();
            jsonify_event.data = json!({
                "key": format!("{:?}", key)
            })
            .to_string();
        }
        EventType::KeyRelease(key) => {
            jsonify_event.event_type = "KeyRelease".to_string();
            jsonify_event.data = json!({
                "key": format!("{:?}", key)
            })
            .to_string();
        }
        EventType::MouseMove { x, y } => {
            jsonify_event.event_type = "MouseMove".to_string();
            jsonify_event.data = json!({
                "x": x,
                "y": y
            })
            .to_string();
        }
        EventType::ButtonPress(key) => {
            jsonify_event.event_type = "ButtonPress".to_string();
            jsonify_event.data = json!({
                "key": format!("{:?}", key)
            })
            .to_string();
        }
        EventType::ButtonRelease(key) => {
            jsonify_event.event_type = "ButtonRelease".to_string();
            jsonify_event.data = json!({
                "key": format!("{:?}", key)
            })
            .to_string();
        }
        EventType::Wheel { delta_x, delta_y } => {
            jsonify_event.event_type = "Wheel".to_string();
            jsonify_event.data = json!({
                "delta_x": delta_x,
                "delta_y": delta_y
            })
            .to_string();
        }
    }

    jsonify_event
}

fn write_text(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    use enigo::{Enigo, Keyboard, Settings};

    // Check platform requirements before attempting text input
    if let Err(e) = platform::check_platform_requirements() {
        let platform_info = platform::get_platform_info();
        eprintln!("Platform error on {} - {}", platform_info, e);
        
        #[cfg(target_os = "linux")]
        if matches!(e, PlatformError::WaylandNotSupported) {
            eprintln!("Hint: Try running in an X11 session or install X11 compatibility layer");
        }
        
        return Err(Box::new(e));
    }

    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(enigo) => enigo,
        Err(e) => {
            let platform_info = platform::get_platform_info();
            eprintln!("Failed to create Enigo instance on {}: {}", platform_info, e);
            
            #[cfg(target_os = "macos")]
            eprintln!("Hint: Ensure Accessibility permissions are granted in System Preferences");
            
            #[cfg(target_os = "linux")]
            eprintln!("Hint: Ensure you're running in an X11 session and have appropriate permissions");
            
            return Err(Box::new(e));
        }
    };

    match enigo.text(text) {
        Ok(_) => Ok(()),
        Err(e) => {
            let platform_info = platform::get_platform_info();
            eprintln!("Failed to write text on {}: {}", platform_info, e);
            Err(Box::new(e))
        }
    }
}

fn listen_for_events() -> Result<(), Box<dyn std::error::Error>> {
    // Check platform requirements before starting listener
    if let Err(e) = platform::check_platform_requirements() {
        let platform_info = platform::get_platform_info();
        eprintln!("Cannot start event listener on {} - {}", platform_info, e);
        
        #[cfg(target_os = "linux")]
        if matches!(e, PlatformError::WaylandNotSupported) {
            eprintln!("Hint: Switch to an X11 session to use keyboard monitoring");
            eprintln!("You can usually switch at the login screen or install X11 compatibility");
        }
        
        return Err(Box::new(e));
    }

    let platform_info = platform::get_platform_info();
    eprintln!("Starting keyboard event listener on {}", platform_info);

    if let Err(e) = listen(move |event| match event.event_type {
        EventType::KeyPress(_) | EventType::KeyRelease(_) => {
            let event = deal_event_to_json(event);
            println!("{}", serde_json::to_string(&event).unwrap());
        }
        _ => {}
    }) {
        eprintln!("Error listening for events: {:?}", e);
        return Err(format!("Listen error: {:?}", e).into());
    }

    Ok(())
}

fn show_usage(program_name: &str) {
    let platform_info = platform::get_platform_info();
    eprintln!("SpeakMCP Rust Platform Helper ({})", platform_info);
    eprintln!("Usage: {} [listen|write <text>|info]", program_name);
    eprintln!("Commands:");
    eprintln!("  listen       - Listen for keyboard events");
    eprintln!("  write <text> - Write text using accessibility API");
    eprintln!("  info         - Show platform information");
    eprintln!();
    eprintln!("Platform-specific notes:");
    
    #[cfg(target_os = "macos")]
    eprintln!("  - Requires Accessibility permissions in System Preferences");
    
    #[cfg(target_os = "linux")]
    eprintln!("  - Requires X11 session (Wayland not supported)");
    
    #[cfg(target_os = "windows")]
    eprintln!("  - No special requirements");
}

fn show_platform_info() {
    let platform_info = platform::get_platform_info();
    println!("Platform: {}", platform_info);
    
    match platform::check_platform_requirements() {
        Ok(_) => println!("Status: Ready"),
        Err(e) => {
            println!("Status: Not ready - {}", e);
            
            #[cfg(target_os = "macos")]
            if matches!(e, PlatformError::AccessibilityDenied) {
                println!("Resolution: Grant Accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility");
            }
            
            #[cfg(target_os = "linux")]
            if matches!(e, PlatformError::WaylandNotSupported) {
                println!("Resolution: Switch to an X11 session or log out and select X11 at login screen");
            }
        }
    }
    
    // Show environment information
    #[cfg(target_os = "linux")]
    {
        if let Ok(display) = env::var("DISPLAY") {
            println!("X11 DISPLAY: {}", display);
        }
        if let Ok(wayland_display) = env::var("WAYLAND_DISPLAY") {
            println!("Wayland DISPLAY: {}", wayland_display);
        }
        if let Ok(session_type) = env::var("XDG_SESSION_TYPE") {
            println!("Session Type: {}", session_type);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let default_name = "speakmcp-rs".to_string();
    let program_name = args.get(0).unwrap_or(&default_name);

    match args.get(1).map(|s| s.as_str()) {
        Some("listen") => {
            if let Err(error) = listen_for_events() {
                let platform_info = platform::get_platform_info();
                eprintln!("Listen command failed on {}: {:?}", platform_info, error);
                process::exit(1);
            }
        }
        Some("write") => {
            if args.len() < 3 {
                eprintln!("Error: write command requires text argument");
                show_usage(program_name);
                process::exit(1);
            }
            
            let text = &args[2];
            match write_text(text) {
                Ok(_) => {
                    process::exit(0);
                }
                Err(e) => {
                    eprintln!("Write command failed: {}", e);
                    process::exit(101);
                }
            }
        }
        Some("info") => {
            show_platform_info();
            process::exit(0);
        }
        _ => {
            show_usage(program_name);
            process::exit(1);
        }
    }
}
