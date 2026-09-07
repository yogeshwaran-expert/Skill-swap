package com.skillswap.repository;

import com.skillswap.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {

    List<Session> findByGroupIdOrderByScheduledAtAsc(Long groupId);

    List<Session> findByGroupIdAndScheduledAtAfterOrderByScheduledAtAsc(Long groupId, LocalDateTime after);
}
