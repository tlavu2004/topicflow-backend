package com.tlavu.topicflow;

import org.springframework.boot.SpringApplication;

public class TestTopicFlowApplication {

	public static void main(String[] args) {
		SpringApplication.from(TopicFlowApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
