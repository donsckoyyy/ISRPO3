import * as vscode from 'vscode';

// Состояние плагина. Его мы сохраняем, чтобы оно пережило перезапуск VS Code.
export interface BreakState {
	workMs: number;       // сколько наработано с последнего засчитанного перерыва
	lastActivity: number; // момент последнего набора текста (Date.now())
	level: number;        // уровень эскалации: 0 — напоминания нет, 1..MAX_LEVEL — есть
	levelSince: number;   // когда включился текущий уровень
}

// Уровни эскалации:
// 1 — уведомление в углу, 2 — предупреждение, 3 — ошибка + красный статус-бар,
// 4 — панель на весь редактор, которая возвращается, если её закрыть
export const MAX_LEVEL = 4;

const STORAGE_KEY = 'smartBreaker.state';

// Новое «чистое» состояние: работа с нуля, напоминаний нет
export function freshState(now: number): BreakState {
	return { workMs: 0, lastActivity: now, level: 0, levelSince: now };
}

// globalState — хранилище «ключ → значение», которое VS Code даёт каждому расширению.
// Оно общее для всех окон и сохраняется между запусками.
export function loadState(context: vscode.ExtensionContext): BreakState {
	return context.globalState.get<BreakState>(STORAGE_KEY) ?? freshState(Date.now());
}

export function saveState(context: vscode.ExtensionContext, state: BreakState): void {
	context.globalState.update(STORAGE_KEY, state);
}
