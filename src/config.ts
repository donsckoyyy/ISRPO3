import * as vscode from 'vscode';

// Все интервалы плагина в миллисекундах
export interface Settings {
	workMs: number;       // сколько можно работать до напоминания
	idleMs: number;       // сколько не печатать, чтобы это считалось перерывом
	breakMs: number;      // сколько должен длиться перерыв, чтобы его засчитать
	escalationMs: number; // как часто напоминание становится настойчивее
	testMode: boolean;    // тестовый режим: «минуты» считаются секундами
}

// Читаем настройки пользователя (Settings → Extensions → Smart Breaker).
// Вызываем на каждом тике, поэтому изменения настроек применяются сразу.
export function readSettings(): Settings {
	const cfg = vscode.workspace.getConfiguration('smartBreaker');
	const testMode = cfg.get<boolean>('testMode', false);
	const unit = testMode ? 1000 : 60_000; // 1 секунда или 1 минута

	return {
		workMs: cfg.get<number>('workMinutes', 120) * unit,
		idleMs: cfg.get<number>('idleMinutes', 5) * unit,
		breakMs: cfg.get<number>('breakMinutes', 30) * unit,
		escalationMs: cfg.get<number>('escalationMinutes', 5) * unit,
		testMode,
	};
}
