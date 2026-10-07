package com.tlavu.topicflow;

import org.springframework.boot.SpringApplication;

public class TestTopicflowApplication {

	public static void main(String[] args) {
		SpringApplication.from(TopicflowApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
