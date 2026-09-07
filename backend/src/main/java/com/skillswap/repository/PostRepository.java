package com.skillswap.repository;

import com.skillswap.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {

    Page<Post> findByGroupIdOrderByCreatedAtDesc(Long groupId, Pageable pageable);
}
