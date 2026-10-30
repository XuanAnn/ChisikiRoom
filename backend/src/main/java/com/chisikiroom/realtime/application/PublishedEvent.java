package com.chisikiroom.realtime.application;

import java.util.List;
import java.util.UUID;

/** Emitted only after the business transaction commits. */
public record PublishedEvent(List<UUID> recipients, String type, Object data) {}
