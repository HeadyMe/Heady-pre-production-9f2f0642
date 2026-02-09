package com.headysystems.pycharm;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.ui.Messages;

public class HeadyPyCharmExtension extends AnAction {
    @Override
    public void actionPerformed(AnActionEvent e) {
        Messages.showInfoMessage("Connected to Heady API", "Heady Connection");
    }
}
