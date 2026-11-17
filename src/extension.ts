import * as vscode from 'vscode';
import { BreakTimer } from './breakTimer';
import { Ui } from './ui';

// вызывается, когда VS Code активирует расширение.
// в package.json указано "onStartupFinished" - сразу после запуска редактора.
export function activate(context: vscode.ExtensionContext) {
	const timer = new BreakTimer(context); // тикает раз в секунду

	const onType = vscode.workspace.onDidChangeTextDocument((event) => { // сообщает редактору если пользователь что то печатает
		const scheme = event.document.uri.scheme;
		if (event.contentChanges.length > 0 && (scheme === 'file' || scheme === 'untitled')) {
			timer.onActivity();
		}
	});

	// команда отображения статуса , и клик по нему, чтобы узнать информацию
	const statusCommand = vscode.commands.registerCommand('smartBreaker.status', () => {
		vscode.window.showInformationMessage('Smart Breaker · ' + Ui.describe(timer.viewInfo()).replace(/\n/g, ' · '));
	});

	// команда сброса таймера
	const resetCommand = vscode.commands.registerCommand('smartBreaker.reset', () => {
		if (timer.reset()) {
			vscode.window.showInformationMessage('Smart Breaker: таймер сброшен.');
		} else {
			vscode.window.showWarningMessage('Smart Breaker: сброс доступен только в тестовом режиме. Иди отдыхать 🙂');
		}
	});

	// всё, что положили в subscriptions, VS Code освободит при выключении расширения: таймер, статус-бар, события
	context.subscriptions.push(timer, onType, statusCommand, resetCommand);
}

export function deactivate() {}
