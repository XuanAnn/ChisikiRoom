package com.chisikiroom;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(
    exclude = org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
public class ChisikiRoomApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChisikiRoomApplication.class, args);
    }
}
