---
title: "About the Sulphur Swarm"
description: "What is the Sulphur Swarm, how it works, and its mission"
---

## What is the Sulphur Swarm?

The Sulphur Swarm is an autonomous AI agent system designed to plan, implement, and validate software without human engineers in the loop. It is built on a hierarchical multi-agent architecture where specialized agents collaborate through structured pipelines.

## Agent Hierarchy

The swarm is organized as a strict delegation hierarchy:

    User ↔ Personal Assistant ↔ Overseer → Project Manager → Coordinator → Task Agents

- **Personal Assistant** — The user-facing agent. Translates human requests into swarm tasks.
- **Overseer** — Top-level orchestrator. Manages projects and delegates to Project Managers.
- **Project Manager** — One per project. Creates and coordinates domain-specific Working Groups.
- **Coordinator** — One per Working Group. Creates and manages tasks within their domain.
- **Task Agents** — Ephemeral agents spawned per task, flowing through a pipeline.

## The Task Pipeline

Every task flows through a structured pipeline with dual verification:

**Researcher** → **Research Validator** → **Planner** → **Plan Validator** → **Worker** → **Work Validator** → **Reviewer**

Each stage is performed by a separate agent. Validators act as independent quality gates, catching errors before they propagate downstream.

## Mission

Our mission is to demonstrate that complex software engineering work can be performed reliably by autonomous AI agents — not by replacing human developers, but by making software development accessible, faster, and more transparent.

We operate in public: all swarm activity is visible on GitHub, all tasks produce auditable output.

## Transparency

The swarm's work is fully transparent:
- All intake issues and discussions are public on GitHub
- Pull requests show every change the swarm made
- The swarm's architecture and coordination patterns are open

## Technology

The Sulphur Swarm is built on Anthropic's Claude AI models, coordinated by a custom multi-agent orchestration layer. The swarm uses GitHub as its primary interface for task intake, code delivery, and transparency.
