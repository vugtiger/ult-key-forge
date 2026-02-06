// Help content for each tab

export const keySystemHelp = {
  title: "Key System Generator",
  description:
    "Create secure key systems that lock each key to a specific Roblox User ID. When a user enters a valid key, it gets permanently bound to their account.",
  features: [
    "Generate unlimited unique 5-character keys",
    "Keys auto-lock to the first user who enters them",
    "Custom ASCII art branding with your name",
    "Customizable UI colors (RGB format)",
    "Auto-downloads a ready-to-use Lua file",
  ],
  steps: [
    {
      title: "Enter number of keys",
      description:
        "Decide how many unique keys you want to generate (e.g., 100 keys for 100 users).",
    },
    {
      title: "Set your key system name",
      description:
        "This name appears as ASCII art in the UI and is used in the DataStore key.",
    },
    {
      title: "Choose a theme color",
      description:
        "Use RGB format (e.g., 255, 255, 255 for white) to customize the UI color.",
    },
    {
      title: "Generate & download",
      description:
        "Click generate to create and download your Lua key system file.",
    },
    {
      title: "Edit the script URL",
      description:
        'In the downloaded file, find "YOUR_SCRIPT_HERE" and replace it with your paste raw URL.',
    },
  ],
  tips: [
    {
      text: "Use the color presets at the bottom for quick color selection",
    },
    {
      text: "The ASCII preview shows exactly how your name will look in-game",
    },
    {
      text: "Keys are stored in Roblox DataStore, so they persist between sessions",
    },
  ],
};

export const scriptStorageHelp = {
  title: "Script Storage",
  description:
    "A secure cloud-based storage for your Lua scripts. Save, organize, and download your scripts from anywhere.",
  features: [
    "Cloud storage for all your scripts",
    "Add names and descriptions",
    "Download as .lua files",
    "Delete when no longer needed",
    "Private and secure storage",
  ],
  steps: [
    {
      title: 'Click "New Script"',
      description: "Open the dialog to add a new script to your storage.",
    },
    {
      title: "Enter script details",
      description:
        "Give your script a name and optional description to remember what it does.",
    },
    {
      title: "Paste your Lua code",
      description: "Copy your script content into the code editor area.",
    },
    {
      title: "Save the script",
      description:
        "Your script is now stored securely in the cloud and accessible anytime.",
    },
  ],
  tips: [
    {
      text: "Use descriptive names to easily find scripts later",
    },
    {
      text: "Add descriptions explaining what each script does",
    },
    {
      text: "Scripts are private and only visible to you",
    },
  ],
};

export const pastebinHelp = {
  title: "Pastebin",
  description:
    "Upload Lua scripts and get raw URLs for loadstring execution. Enable protection to control who can execute your scripts.",
  features: [
    "Upload code and get instant raw URLs",
    "Protection mode with whitelist/blacklist",
    "Public protection (anyone can execute, blacklist still works)",
    "Hide code from raw URL (blank page but loadstring works)",
    "Set expiration times for whitelisted users",
  ],
  steps: [
    {
      title: "Create a new paste",
      description:
        "Enter your Lua code and click Upload to get your raw URL.",
    },
    {
      title: "Copy the raw URL",
      description:
        "Use this URL in loadstring() to execute your script: loadstring(game:HttpGet('URL'))()",
    },
    {
      title: "Enable protection (optional)",
      description:
        "Turn on protection to require whitelist access for execution.",
    },
    {
      title: "Add users to whitelist/blacklist",
      description:
        "Enter Roblox User IDs to control who can and cannot execute your script.",
    },
    {
      title: "Set whitelist times (optional)",
      description:
        "Go to Whitelist Time tab to set expiration times for users.",
    },
  ],
  tips: [
    {
      text: "Use Public Protection to allow anyone to execute while still blocking blacklisted users",
    },
    {
      text: "Hide Code makes the raw URL show blank, but loadstring still works",
    },
    {
      text: "You can edit paste content without changing the URL",
    },
  ],
};

export const scriptSettingsHelp = {
  title: "Script Settings",
  description:
    "Monitor who accesses your scripts in real-time and restrict execution to specific games.",
  features: [
    "Live access monitoring with Roblox profiles",
    "Discord OAuth identification for browser visitors",
    "IP tracking (toggleable per paste)",
    "Game binding restrictions",
    "Delete access logs",
  ],
  steps: [
    {
      title: "Select a paste",
      description: "Choose which paste you want to monitor or configure.",
    },
    {
      title: "View access logs",
      description:
        "See who executed your script, their Roblox profile, and when.",
    },
    {
      title: "Toggle IP tracking",
      description:
        "Enable/disable IP logging for privacy. Browser visitors see Discord OAuth.",
    },
    {
      title: "Set up game bindings (optional)",
      description:
        "Restrict your script to only work in specific Roblox games.",
    },
  ],
  tips: [
    {
      text: "Green indicators = executor access, Red = browser visit",
    },
    {
      text: "Game bindings use Game ID or Place ID from the Roblox game URL",
    },
    {
      text: "Discord identification requires users to log in with Discord when visiting",
    },
  ],
};

export const aiAssistantHelp = {
  title: "AI Assistant",
  description:
    "Get help with Roblox scripting, code fixes, and learning Lua. The AI can generate scripts, explain code, and even help build websites.",
  features: [
    "Generate Roblox scripts from descriptions",
    "Fix and debug code issues",
    "Learn Lua programming concepts",
    "Get code explanations",
    "Build websites with AI",
  ],
  steps: [
    {
      title: "Describe what you need",
      description:
        'Type your request, like "Create a script that gives players speed boost".',
    },
    {
      title: "Review the response",
      description:
        "The AI will generate code or explanations based on your request.",
    },
    {
      title: "Copy or modify",
      description: "Use the generated code directly or ask for modifications.",
    },
    {
      title: "Ask follow-up questions",
      description:
        "Continue the conversation to refine or expand on the response.",
    },
  ],
  tips: [
    {
      text: "Be specific about what you want for better results",
    },
    {
      text: "Ask the AI to explain code if you don't understand it",
    },
    {
      text: "You can ask for modifications like 'make it faster' or 'add a GUI'",
    },
  ],
};

export const discordBotHelp = {
  title: "Discord Bot",
  description:
    "Manage everything directly from Discord! Create key systems, manage pastes, set up buyer control panels with key redemption and auto-role assignment.",
  features: [
    "All features accessible via Discord commands",
    "Interactive control panels with buttons",
    "Generate keys with custom expiration times",
    "Auto-whitelist users when they redeem keys",
    "Console blacklist to block users from panels",
  ],
  steps: [
    {
      title: "Invite the bot",
      description: 'Click the "Invite Bot to Server" button above.',
    },
    {
      title: "Register or login",
      description:
        "Use /register to create a new account or /login to link existing.",
    },
    {
      title: "Start using commands",
      description:
        "Use slash commands like /paste, /keysystemgen, /panel, etc.",
    },
    {
      title: "Set up control panels (optional)",
      description:
        "Use /panel to create buyer panels where users can redeem keys.",
    },
  ],
  tips: [
    {
      text: "Use /help to see all available commands",
    },
    {
      text: "Control panels can auto-assign Discord roles on key redemption",
    },
    {
      text: "Use /genkeys with hours/minutes/days to create expiring keys",
    },
  ],
};

export const analyticsHelp = {
  title: "Analytics",
  description:
    "Track your usage statistics and see how your scripts and key systems are performing over time.",
  features: [
    "View execution statistics",
    "Track key usage patterns",
    "Monitor paste access counts",
    "Historical data visualization",
  ],
  steps: [
    {
      title: "View your stats",
      description: "See an overview of your activity and usage.",
    },
    {
      title: "Analyze trends",
      description: "Look at how your scripts are being used over time.",
    },
  ],
  tips: [
    {
      text: "Check analytics regularly to understand your audience",
    },
    {
      text: "High execution counts indicate popular scripts",
    },
  ],
};

export const changelogHelp = {
  title: "Changelog",
  description:
    "Stay updated with the latest features, improvements, and bug fixes. Major releases are highlighted.",
  features: [
    "Latest feature announcements",
    "Bug fix notifications",
    "Version history timeline",
    "Major release highlights",
  ],
  steps: [
    {
      title: "Check for updates",
      description: "Visit this page to see what's new.",
    },
    {
      title: "Read release notes",
      description: "Each entry lists specific changes and improvements.",
    },
  ],
  tips: [
    {
      text: "Major releases are marked with special badges",
    },
    {
      text: "Check back regularly for new features",
    },
  ],
};

export const settingsHelp = {
  title: "Settings",
  description:
    "Customize your experience with theme colors, text effects, and language preferences. Manage your account and active sessions.",
  features: [
    "Custom text colors (RGB format)",
    "Neon glow text effect",
    "ULT LUA bold italic style",
    "16 color presets",
    "Multi-language support (32 languages)",
    "Session management",
  ],
  steps: [
    {
      title: "Choose a text color",
      description:
        "Enter RGB values or click a color preset to change your theme.",
    },
    {
      title: "Enable effects (optional)",
      description:
        "Toggle Neon Effect for glowing text or ULT LUA Style for bold italic.",
    },
    {
      title: "Save your changes",
      description: 'Click "Save Changes" to apply your theme settings.',
    },
    {
      title: "Change language (optional)",
      description:
        "Use the language dropdown to translate the interface.",
    },
  ],
  tips: [
    {
      text: "Theme settings are saved to your account and restore on login",
    },
    {
      text: "Use the preview box to see how your settings will look",
    },
    {
      text: "Click Reset to return to default white text",
    },
  ],
};
