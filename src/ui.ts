import * as vscode from 'vscode';
import { MAX_LEVEL } from './state';

// все что нужно интерфейсу, чтобы нарисовать текущее состояние
export interface ViewInfo {
	level: number;    // уровень эскалации (0 — напоминания нет)
	resting: boolean; // пользователь сейчас отдыхает (давно не печатал)
	workMs: number;   // сколько наработано
	workLeftMs: number; // сколько осталось работать до напоминания
	restLeftMs: number; // сколько ещё отдыхать, чтобы перерыв засчитался
	tip: string;      // текущий совет
}

// конвертация мс во время: 3725000 мс = "1:02:05", 125000 мс = "2:05"
export function formatDuration(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const two = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

// все, что пользователь видит: статус-бар, уведомления, панель Webview
export class Ui implements vscode.Disposable {
	private statusBar: vscode.StatusBarItem;

	// самозакрывающееся уведомление (уровень 1).
	// это «уведомление с прогрессом»: оно висит, пока не выполнится Promise.
	// closeProgress — функция resolve этого Promise: вызвали её — уведомление исчезло.
	private closeProgress?: () => void;
	private reportProgress?: (message: string) => void;
	private lastProgressMessage = '';

	// панель Webview (уровень 4)
	private panel?: vscode.WebviewPanel;
	private wantPanel = false; // должна ли панель сейчас быть открыта
	private lastPanelHtml = '';

	constructor() {
		this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBar.command = 'smartBreaker.status'; // клик по статус-бару вызывает команду
		this.statusBar.show();
	}

	// Показать напоминание нужного уровня
	showLevel(level: number, tip: string): void {
		if (level === 1) {
			this.closePanel(); // вернулся раньше времени → снова «мягкий» режим
			this.showProgress(`Пора отдохнуть! ${tip}`);
		} else if (level === 2) {
			vscode.window.showWarningMessage(`Smart Breaker: ты всё ещё работаешь. ${tip}`);
		} else if (level === 3) {
			vscode.window.showErrorMessage(`Smart Breaker: хватит! Сделай перерыв. ${tip}`);
		} else if (level >= MAX_LEVEL) {
			this.openPanel();
		}
	}

	// убрать все напоминания (перерыв засчитан)
	hideAll(): void {
		this.closeProgressNotification();
		this.closePanel();
	}

	// вызывается на каждом тике: обновляем всё, что показывает время
	update(info: ViewInfo): void {
		this.updateStatusBar(info);

		if (info.level > 0) {
			const message = info.resting
				? `Отдыхаешь… осталось ${formatDuration(info.restLeftMs)}`
				: `Пора отдохнуть! ${info.tip}`;
			this.showProgress(message);
		}

		if (this.panel) {
			this.updatePanel(info);
		}
	}

	// текст для команды «Показать статус» и подсказки статус-бара
	static describe(info: ViewInfo): string {
		const lines = [
			`Наработано: ${formatDuration(info.workMs)}`,
			info.level > 0
				? `Напоминание: уровень ${info.level} из ${MAX_LEVEL}`
				: `До перерыва: ${formatDuration(info.workLeftMs)}`,
		];
		if (info.resting && info.workMs > 0) {
			lines.push(`Отдых: осталось ${formatDuration(info.restLeftMs)}`);
		}
		return lines.join('\n');
	}

	private updateStatusBar(info: ViewInfo): void {
		if (info.resting && info.workMs > 0) {
			this.statusBar.text = `$(coffee) отдых: ${formatDuration(info.restLeftMs)}`;
		} else if (info.level > 0) {
			this.statusBar.text = `$(warning) пора отдохнуть!`;
		} else {
			this.statusBar.text = `$(clock) ${formatDuration(info.workLeftMs)} до перерыва`;
		}

		// цвет статус-бара зависит от уровня эскалации
		if (info.level >= 3) {
			this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		} else if (info.level === 2) {
			this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		} else {
			this.statusBar.backgroundColor = undefined;
		}

		this.statusBar.tooltip = `Smart Breaker\n${Ui.describe(info)}`;
	}

	// --- уровень 1: уведомление, которое закрывается само ---

	private showProgress(message: string): void {
		if (this.reportProgress) {
			// Уведомление уже висит — просто меняем текст (если он изменился)
			if (message !== this.lastProgressMessage) {
				this.reportProgress(message);
				this.lastProgressMessage = message;
			}
			return;
		}

		this.lastProgressMessage = message;
		vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Smart Breaker', cancellable: false },
			(progress) => new Promise<void>((resolve) => {
				this.closeProgress = resolve;
				this.reportProgress = (text) => progress.report({ message: text });
				progress.report({ message });
			}),
		);
	}

	private closeProgressNotification(): void {
		this.closeProgress?.();
		this.closeProgress = undefined;
		this.reportProgress = undefined;
		this.lastProgressMessage = '';
	}

	// --- уровень 4: панель на весь редактор ---

	private openPanel(): void {
		this.wantPanel = true;

		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Active);
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'smartBreaker',                 // внутренний тип панели
			'Smart Breaker — перерыв!',     // заголовок вкладки
			vscode.ViewColumn.Active,     // открыть поверх текущего редактора
			{},
		);
		this.lastPanelHtml = '';

		// убираем боковую и нижнюю панели, чтобы перерыв занял как можно больше места.
		// если какой-то команды нет в этой версии VS Code — просто игнорируем ошибку.
		const ignore = () => undefined;
		vscode.commands.executeCommand('workbench.action.closeSidebar').then(undefined, ignore);
		vscode.commands.executeCommand('workbench.action.closePanel').then(undefined, ignore);

		// панель закрыли (крестиком или сами)
		this.panel.onDidDispose(() => {
			this.panel = undefined;
			if (this.wantPanel) {
				// перерыв ещё не засчитан → через секунду открываем панель снова
				setTimeout(() => {
					if (this.wantPanel) {
						this.openPanel();
					}
				}, 1000);
			}
		});
	}

	private updatePanel(info: ViewInfo): void {
		if (!this.panel) {
			return;
		}

		// пользователь переключился на другую вкладку → возвращаем панель на передний план
		if (!this.panel.visible) {
			this.panel.reveal(vscode.ViewColumn.Active);
		}

		const status = info.resting
			? `Отдых идёт. Осталось: <b>${formatDuration(info.restLeftMs)}</b>`
			: `Отойди от компьютера. Панель исчезнет сама, когда ты отдохнёшь.`;
		const html = panelHtml(info.tip, status);

		// перерисовываем, только если текст поменялся — иначе страница будет мигать
		if (html !== this.lastPanelHtml) {
			this.panel.webview.html = html;
			this.lastPanelHtml = html;
		}
	}

	private closePanel(): void {
		this.wantPanel = false; // важно сделать ДО dispose, чтобы панель не «воскресла»
		this.panel?.dispose();
		this.panel = undefined;
	}

	dispose(): void {
		this.hideAll();
		this.statusBar.dispose();
	}
}

// HTML-страница панели, цвета берём из темы VS Code через CSS-переменные.
function panelHtml(tip: string, status: string): string {
	return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
	body {
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		height: 100vh; margin: 0; text-align: center;
		font-family: var(--vscode-font-family);
		color: var(--vscode-foreground);
		background: var(--vscode-editor-background);
	}
	.emoji { font-size: 96px; }
	h1 { font-size: 40px; margin: 16px 0; }
	p { font-size: 20px; max-width: 600px; opacity: 0.85; }
</style>
</head>
<body>
	<div class="emoji">🧘</div>
	<h1>Пора сделать перерыв</h1>
	<p>${tip}</p>
	<p>${status}</p>
</body>
</html>`;
}
