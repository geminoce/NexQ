use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    AppHandle,
};

/// Build the idle-state tray menu.
pub fn build_idle_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let start = MenuItem::with_id(app, "start_meeting", "Начать встречу", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let copy_ai = MenuItem::with_id(
        app,
        "copy_ai_answer",
        "Копировать последний AI-ответ",
        true,
        None::<&str>,
    )?;
    let copy_actions = MenuItem::with_id(
        app,
        "copy_action_items",
        "Копировать задачи",
        true,
        None::<&str>,
    )?;
    let copy_summary = MenuItem::with_id(app, "copy_summary", "Копировать сводку", true, None::<&str>)?;
    let copy_transcript = MenuItem::with_id(
        app,
        "copy_transcript",
        "Копировать транскрипт",
        true,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let settings = MenuItem::with_id(app, "settings", "Настройки", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выйти из NexQ", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &start,
            &sep1,
            &copy_ai,
            &copy_actions,
            &copy_summary,
            &copy_transcript,
            &sep2,
            &settings,
            &quit,
        ],
    )
}

/// Build the meeting-active tray menu.
pub fn build_meeting_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let stop = MenuItem::with_id(app, "stop_meeting", "Завершить встречу", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let mute_mic = MenuItem::with_id(app, "toggle_mic", "Выключить микрофон", true, None::<&str>)?;
    let mute_sys = MenuItem::with_id(
        app,
        "toggle_system",
        "Выключить системный звук",
        true,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let stealth = MenuItem::with_id(app, "toggle_stealth", "Скрытый режим", true, None::<&str>)?;
    let show_overlay = MenuItem::with_id(app, "show_overlay", "Показать overlay", true, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let copy_ai = MenuItem::with_id(
        app,
        "copy_ai_answer",
        "Копировать последний AI-ответ",
        true,
        None::<&str>,
    )?;
    let copy_actions = MenuItem::with_id(
        app,
        "copy_action_items",
        "Копировать задачи",
        true,
        None::<&str>,
    )?;
    let copy_summary = MenuItem::with_id(app, "copy_summary", "Копировать сводку", true, None::<&str>)?;
    let copy_transcript = MenuItem::with_id(
        app,
        "copy_transcript",
        "Копировать транскрипт",
        true,
        None::<&str>,
    )?;
    let sep4 = PredefinedMenuItem::separator(app)?;
    let settings = MenuItem::with_id(app, "settings", "Настройки", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выйти из NexQ", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &stop,
            &sep1,
            &mute_mic,
            &mute_sys,
            &sep2,
            &stealth,
            &show_overlay,
            &sep3,
            &copy_ai,
            &copy_actions,
            &copy_summary,
            &copy_transcript,
            &sep4,
            &settings,
            &quit,
        ],
    )
}
