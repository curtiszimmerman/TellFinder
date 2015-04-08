---
section: Tour
subtitle: Overview
permalink: tour/overview/index.html
rootpath: ../../
layout: submenu
---

# Overview #

TellFinder simplifies the process of investigating human trafficking cases by automatically characterizing and organizing publicly available Internet escort advertisements. This allows users to quickly locate or discover potentially illicit activity by the entities and organizations that post the ads.

## Ad Scraping and Feature Extraction ##

TellFinder is powered by an extensive database of ads scraped from websites in the adult services domain. Advertisements are scraped on a daily basis. 

Natural language processing extracts key identifying attributes from the ads, which are then stored in a SQL database. Additional extraction and cleaning captures obfuscated attributes (e.g., a phone number written as 508 5five5 38four1) and normalizes the extracted features.

## Ad Grouping ##

Using the scraped and cleaned attributes in the TellFinder databases, sophisticated clustering algorithms group ads that repeat the same identifying attributes: phone numbers, email addresses and websites. Each clustered ad group then represents an entity that exhibits the common features in the related postings.

Each ad belongs to one ad group, but because entities and organizations can share resources, the same identifying attributes can appear in multiple ad groups. TellFinder's entity resolution visualizations use these shared attributes to illustrate the connections between entities and organizations.

For example, an ad may reference a particular phone number *(123) 555-4567* and an email address `org@example.com`. In TellFinder, this ad might be placed in an ad group that represents an entity who uses the phone number. When users view the entity, they will see its connection to other entities or organizations that reference the same email address.

## User Workflow ##

TellFinder supports multiple investigative techniques:

- **Discovery**: Select a region and a timeframe to browse through all adult service ad activity and find previously unknown entities and organizations connected to human trafficking.
- **Search**: Search through the entire ad archive for a tip (a name, phone number or email address) to find case-related entities and organizations, saving hours of manual web searches.

## Next ##

Review the [System Description](../components/) for more information on the individual components that make up TellFinder workflow.