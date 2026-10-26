package com.chisikiroom.calling.domain;

/** LAN mesh policy; deliberately independent of Battle scoring and readiness. */
public final class CallPolicy {

    private CallPolicy() {}

    public static final int MAX_PARTICIPANTS = 4;
    public static final int DISCONNECT_SECONDS = 30;
    public static final int UNANSWERED_SECONDS = 45;
}
