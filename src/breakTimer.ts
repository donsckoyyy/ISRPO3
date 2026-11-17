import * as vscode from 'vscode';
import { readSettings } from './config';
import { BreakState, MAX_LEVEL, freshState, loadState, saveState } from './state';
import { randomTip } from './tips';
import { Ui, ViewInfo } from './ui';

const TICK_MS = 1000;      // проверяем состояние раз в секунду
const SAVE_EVERY_TICKS = 5; // сохраняем состояние раз в 5 секунд

// «мозг» плагина: считает рабочее время, распознаёт перерывы и управляет эскалацией
export class BreakTimer implements vscode.Disposable {
	private state: BreakState;
	private ui = new Ui();
	private tip = randomTip();
	private lastTick = Date.now();
	private ticks = 0;
	private interval: ReturnType<typeof setInterval>;

	constructor(private context: vscode.ExtensionContext) { // восстанавливаем состояние после перезапуска VS Code.
		// время, пока VS Code был закрыт, работой не считается: lastTick = «сейчас».
		this.state = loadState(context);

		// Первый тик сразу: если VS Code был закрыт дольше перерыва, он его засчитает
		this.tick();

		if (this.state.level > 0) {
			// Напоминание было активно до перезапуска и перерыва не было — показываем снова
			this.ui.showLevel(this.state.level, this.tip);
		}

		this.interval = setInterval(() => this.tick(), TICK_MS);
	}

	// Вызывается при каждом наборе текста
	onActivity(): void {
		const now = Date.now();
		const settings = readSettings();
		const wasResting = now - this.state.lastActivity >= settings.idleMs;

		this.state.lastActivity = now;

		// Отдыхал, но меньше нужного и вернулся при активном напоминании →
		// перерыв не засчитан, эскалация начинается заново с первого уровня
		if (wasResting && this.state.level > 0) {
			this.setLevel(1, now);
		}
	}

	// Основной цикл: раз в секунду решаем, что сейчас происходит
	private tick(): void {
		const now = Date.now();
		const settings = readSettings();
		const elapsed = now - this.lastTick; // сколько прошло с прошлого тика
		this.lastTick = now;

		const idleFor = now - this.state.lastActivity; // сколько не печатаешь
		const resting = idleFor >= settings.idleMs;

		if (resting && idleFor >= settings.breakMs) {
			// Перерыв засчитан: обнуляем работу и убираем напоминания
			if (this.state.workMs > 0 || this.state.level > 0) {
				this.state = freshState(this.state.lastActivity);
				this.ui.hideAll();
				this.tip = randomTip();
			}
		} else if (!resting) {
			// Работаешь: копим время
			this.state.workMs += elapsed;

			if (this.state.level === 0 && this.state.workMs >= settings.workMs) {
				// Наработал лимит → первое напоминание
				this.setLevel(1, now);
			} else if (
				this.state.level > 0 &&
				this.state.level < MAX_LEVEL &&
				now - this.state.levelSince >= settings.escalationMs
			) {
				// Напоминание проигнорировали → следующий уровень
				this.setLevel(this.state.level + 1, now);
			}
		}
		// Если отдыхаешь, но перерыв ещё не набрался — ничего не копим и не эскалируем

		this.ui.update(this.viewInfo(now));

		this.ticks++;
		if (this.ticks % SAVE_EVERY_TICKS === 0) {
			saveState(this.context, this.state);
		}
	}

	private setLevel(level: number, now: number): void {
		this.state.level = level;
		this.state.levelSince = now;
		this.ui.showLevel(level, this.tip);
	}

	// Собираем данные для отображения
	viewInfo(now = Date.now()): ViewInfo {
		const settings = readSettings();
		const idleFor = now - this.state.lastActivity;
		return {
			level: this.state.level,
			resting: idleFor >= settings.idleMs,
			workMs: this.state.workMs,
			workLeftMs: settings.workMs - this.state.workMs,
			restLeftMs: settings.breakMs - idleFor,
			tip: this.tip,
		};
	}

	// аварийный сброс (доступен только в тестовом режиме, иначе это «обход» плагина)
	reset(): boolean {
		if (!readSettings().testMode) {
			return false;
		}
		this.state = freshState(Date.now());
		this.ui.hideAll();
		saveState(this.context, this.state);
		return true;
	}

	// Вызывается при выключении расширения (через context.subscriptions)
	dispose(): void {
		clearInterval(this.interval);
		saveState(this.context, this.state);
		this.ui.dispose();
	}
}
