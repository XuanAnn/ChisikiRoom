package com.chisikiroom.identity.infrastructure;

import com.chisikiroom.identity.application.AuthService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain security(
        HttpSecurity http,
        AuthService auth,
        com.chisikiroom.administration.application.TrafficMonitor monitor,
        com.chisikiroom.administration.infrastructure.ClientAddressResolver addresses
    ) throws Exception {
        return http
            .csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a ->
                a
                    .dispatcherTypeMatchers(DispatcherType.ERROR)
                    .permitAll()
                    .requestMatchers(
                        "/api/auth/register",
                        "/api/auth/login",
                        "/actuator/health",
                        "/ws",
                        "/admin.html",
                        "/admin.js",
                        "/admin.css",
                        "/api/admin/**"
                    )
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            )
            .exceptionHandling(e ->
                e.authenticationEntryPoint((req, res, ex) -> res.sendError(401))
            )
            .addFilterBefore(
                new OncePerRequestFilter() {
                    @Override
                    protected void doFilterInternal(
                        HttpServletRequest req,
                        HttpServletResponse res,
                        FilterChain chain
                    ) throws ServletException, IOException {
                        String value = req.getHeader("Authorization");
                        if (value != null && value.startsWith("Bearer ") && value.length() < 200) {
                            auth.resolve(value.substring(7)).ifPresent(profile -> {
                                monitor.touch(profile.id(), addresses.resolve(req));
                                SecurityContextHolder.getContext().setAuthentication(
                                    new UsernamePasswordAuthenticationToken(
                                        profile,
                                        null,
                                        List.of()
                                    )
                                );
                            });
                        }
                        chain.doFilter(req, res);
                    }
                },
                UsernamePasswordAuthenticationFilter.class
            )
            .build();
    }
}
