package com.skillswap.repository;

import com.skillswap.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    Page<Message> findByGroupIdOrderByCreatedAtDesc(Long groupId, Pageable pageable);
}
