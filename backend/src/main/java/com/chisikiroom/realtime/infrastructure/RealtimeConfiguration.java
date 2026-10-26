package com.chisikiroom.realtime.infrastructure;

import com.chisikiroom.identity.application.AuthService;
import java.util.List;
import org.springframework.context.annotation.*;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.config.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class RealtimeConfiguration implements WebSocketMessageBrokerConfigurer {

    private final AuthService auth;
    private final java.util.concurrent.ConcurrentHashMap<String, String> sessionTokens =
        new java.util.concurrent.ConcurrentHashMap<>();

    public RealtimeConfiguration(AuthService auth) {
        this.auth = auth;
    }

    @Bean
    public ThreadPoolTaskScheduler brokerHeartbeatScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("stomp-heartbeat-");
        return scheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Desktop connects from the main process without browser cookies.
        registry.addEndpoint("/ws");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry
            .enableSimpleBroker("/queue")
            .setTaskScheduler(brokerHeartbeatScheduler())
            .setHeartbeatValue(new long[] { 10000, 10000 });
        registry.setUserDestinationPrefix("/user");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
            .setMessageSizeLimit(65536)
            .setSendBufferSizeLimit(262144)
            .setSendTimeLimit(15000)
            .setTimeToFirstMessage(10000);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(
            new ChannelInterceptor() {
                @Override
                public Message<?> preSend(Message<?> message, MessageChannel channel) {
                    var headers = MessageHeaderAccessor.getAccessor(
                        message,
                        StompHeaderAccessor.class
                    );
                    if (headers == null || headers.getCommand() == null) {
                        return message;
                    }
                    var command = headers.getCommand();
                    if (command == StompCommand.CONNECT) {
                        String bearer = headers.getFirstNativeHeader("Authorization");
                        if (
                            bearer == null || !bearer.startsWith("Bearer ") || bearer.length() > 200
                        ) {
                            throw new AccessDeniedException("UNAUTHORIZED");
                        }
                        var profile = auth
                            .resolve(bearer.substring(7))
                            .orElseThrow(() -> new AccessDeniedException("UNAUTHORIZED"));
                        headers.setUser(
                            new UsernamePasswordAuthenticationToken(
                                profile.id().toString(),
                                null,
                                List.of()
                            )
                        );
                        sessionTokens.put(headers.getSessionId(), bearer.substring(7));
                    } else if (command == StompCommand.SUBSCRIBE) {
                        String token = sessionTokens.get(headers.getSessionId());
                        if (
                            headers.getUser() == null ||
                            token == null ||
                            auth.resolve(token).isEmpty() ||
                            !"/user/queue/events".equals(headers.getDestination())
                        ) {
                            throw new AccessDeniedException("FORBIDDEN");
                        }
                    } else if (
                        command != StompCommand.DISCONNECT && command != StompCommand.UNSUBSCRIBE
                    ) {
                        throw new AccessDeniedException("USE_REST_API");
                    }
                    return message;
                }
            }
        );
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(
            new ChannelInterceptor() {
                @Override
                public Message<?> preSend(Message<?> message, MessageChannel channel) {
                    var headers = MessageHeaderAccessor.getAccessor(
                        message,
                        org.springframework.messaging.simp.SimpMessageHeaderAccessor.class
                    );
                    if (
                        headers != null &&
                        headers.getMessageType() ==
                            org.springframework.messaging.simp.SimpMessageType.MESSAGE
                    ) {
                        String token = sessionTokens.get(headers.getSessionId());
                        if (token == null || auth.resolve(token).isEmpty()) {
                            return null;
                        }
                    }
                    return message;
                }
            }
        );
    }

    @org.springframework.context.event.EventListener
    public void disconnected(
        org.springframework.web.socket.messaging.SessionDisconnectEvent event
    ) {
        sessionTokens.remove(event.getSessionId());
    }
}
