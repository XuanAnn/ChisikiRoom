package com.chisikiroom.administration.infrastructure;

import com.chisikiroom.administration.application.TrafficMonitor;
import com.chisikiroom.chat.application.ChatService;
import com.chisikiroom.identity.application.AuthService;
import com.chisikiroom.realtime.application.PublishedEvent;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class TrafficEventListener {

    private final TrafficMonitor monitor;
    private final ClientAddressResolver addresses;

    public TrafficEventListener(TrafficMonitor monitor, ClientAddressResolver addresses) {
        this.addresses = addresses;
        this.monitor = monitor;
    }

    @EventListener
    public void published(PublishedEvent event) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        UUID sender = null;
        if (
            authentication != null &&
            authentication.getPrincipal() instanceof AuthService.Profile profile
        ) {
            sender = profile.id();
        }
        String ip = "Server";
        if (
            RequestContextHolder.getRequestAttributes() instanceof
                ServletRequestAttributes attributes
        ) {
            ip = addresses.resolve(attributes.getRequest());
        }
        String summary = "Sự kiện " + event.type();
        if (event.data() instanceof ChatService.ChatMessage message) {
            summary = message.content();
        }
        if (event.data() instanceof java.util.Map<?, ?> fields) {
            Object kind = fields.get("kind");
            if (kind instanceof String signalKind) {
                summary = event.type() + " · " + signalKind;
            }
        }
        if (summary == null) {
            summary = "Tin nhắn đã xóa";
        }
        if (summary.length() > 1000) {
            summary = summary.substring(0, 1000) + "…";
        }
        monitor.record(sender, ip, event.recipients(), event.type(), summary);
    }
}
